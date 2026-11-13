package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.LatePaymentRecord;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.enums.LatePaymentStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.repository.LatePaymentRecordRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.DebtReminderMailService;
import com.kitolam.rentalroommanagement.modules.invoice.service.DebtReminderMailService.DebtReminderMail;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Mỗi ngày quét hoá đơn còn nợ: ghi nhận số ngày trễ theo kỳ vào {@link LatePaymentRecord} và, khi
 * quá hạn từ 3 ngày, nhắc người thuê trong ứng dụng + gửi email cảnh cáo. Nhắc lại mỗi
 * {@code reminderIntervalDays} ngày để không dội thư. Kỳ đã thu đủ được đóng lại (SETTLED).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DebtReminderJob {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int REMINDER_AFTER_DAYS = 3;
    private static final int DEFAULT_REMINDER_INTERVAL_DAYS = 3;
    private static final List<InvoiceStatus> OUTSTANDING =
            List.of(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE);

    private final InvoiceRepository invoiceRepository;
    private final LatePaymentRecordRepository latePaymentRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final NotificationService notificationService;
    private final DebtReminderMailService mailService;
    private final Clock clock;

    @Scheduled(cron = "${invoice.reminder.cron:0 15 7 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void run() {
        int reminded = sweep(LocalDate.ofInstant(clock.instant(), ZONE), DEFAULT_REMINDER_INTERVAL_DAYS);
        if (reminded > 0) log.info("Debt reminder job: sent {} reminders", reminded);
    }

    /** Public để chạy tay/kiểm thử. Trả về số lần nhắc đã gửi. */
    public int sweep(LocalDate today, int reminderIntervalDays) {
        var query = Query.query(new Criteria().andOperator(
                Criteria.where("isDeleted").is(false),
                Criteria.where("status").in(OUTSTANDING.stream().map(Enum::name).toList()),
                Criteria.where("remainingAmount").gt(BigDecimal.ZERO),
                Criteria.where("dueDate").ne(null)));
        List<Invoice> invoices = mongoTemplate.find(query, Invoice.class);

        int sent = 0;
        for (Invoice invoice : invoices) {
            long overdueDays = ChronoUnit.DAYS.between(invoice.getDueDate(), today);
            if (overdueDays <= 0) continue;
            try {
                LatePaymentRecord record = record(invoice, today, overdueDays);
                if (shouldRemind(record, today, reminderIntervalDays) && remind(invoice, record, today, overdueDays)) {
                    record.setReminderCount(record.getReminderCount() + 1);
                    record.setLastReminderAt(clock.instant());
                    latePaymentRepository.save(record);
                    sent++;
                }
            } catch (RuntimeException failed) {
                log.warn("Debt reminder failed invoice={}", invoice.getId(), failed);
            }
        }
        settleClosedRecords(today);
        return sent;
    }

    private LatePaymentRecord record(Invoice invoice, LocalDate today, long overdueDays) {
        LatePaymentRecord record = latePaymentRepository
                .findByContractIdAndPeriodAndIsDeletedFalse(invoice.getContractId(), invoice.getPeriod())
                .orElseGet(() -> {
                    LatePaymentRecord created = new LatePaymentRecord();
                    created.setContractId(invoice.getContractId());
                    created.setPeriod(invoice.getPeriod());
                    created.setInvoiceNumber(invoice.getInvoiceNumber());
                    created.setInvoiceId(invoice.getId());
                    created.setTenantId(invoice.getTenantId());
                    created.setBranchId(invoice.getBranchId());
                    created.setRoomNumber(invoice.getRoomNumber());
                    created.setTenantName(invoice.getTenantName());
                    created.setDueDate(invoice.getDueDate());
                    created.setStatus(LatePaymentStatus.OPEN);
                    return created;
                });
        record.setInvoiceId(invoice.getId());
        record.setTenantId(invoice.getTenantId());
        record.setBranchId(invoice.getBranchId());
        record.setRoomNumber(invoice.getRoomNumber());
        record.setTenantName(invoice.getTenantName());
        record.setInvoiceNumber(invoice.getInvoiceNumber());
        record.setDueDate(invoice.getDueDate());
        if (record.getFirstOverdueDate() == null) {
            record.setFirstOverdueDate(invoice.getDueDate().plusDays(1));
        }
        record.setLateDays(Math.max(record.getLateDays(), overdueDays));
        record.setTotalAmount(invoice.getTotalAmount());
        record.setPaidAmount(invoice.getPaidAmount());
        record.setRemainingAmount(invoice.getRemainingAmount());
        record.setLastEvaluatedAt(clock.instant());
        return latePaymentRepository.save(record);
    }

    private boolean shouldRemind(LatePaymentRecord record, LocalDate today, int intervalDays) {
        if (record.getLateDays() < REMINDER_AFTER_DAYS) return false;
        if (record.getLastReminderAt() == null) return true;
        LocalDate last = LocalDate.ofInstant(record.getLastReminderAt(), ZONE);
        return !last.plusDays(intervalDays).isAfter(today);
    }

    private boolean remind(Invoice invoice, LatePaymentRecord record, LocalDate today, long overdueDays) {
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(invoice.getTenantId()).orElse(null);
        String email = tenant != null ? tenant.getEmail() : null;
        String fullName = tenant != null && tenant.getFullName() != null ? tenant.getFullName() : invoice.getTenantName();
        String roomNumber = record.getRoomNumber() != null ? record.getRoomNumber() : invoice.getRoomNumber();

        mailService.send(new DebtReminderMail(email, fullName, roomNumber, null,
                invoice.getInvoiceNumber(), invoice.getPeriod(), invoice.getDueDate(), overdueDays,
                invoice.getRemainingAmount()));

        publishInbox(tenant, record, invoice, overdueDays);
        if (email == null || email.isBlank()) {
            log.warn("Hoá đơn {} quá hạn nhưng người thuê không có email; chỉ gửi thông báo trong ứng dụng",
                    invoice.getInvoiceNumber());
        }
        return true;
    }

    private void publishInbox(Tenant tenant, LatePaymentRecord record, Invoice invoice, long overdueDays) {
        if (tenant == null || tenant.getEmail() == null) return;
        String accountId = userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail())
                .map(user -> user.getId()).orElse(null);
        if (accountId == null) return;
        String title = "Nhắc thanh toán công nợ";
        String message = "Hoá đơn " + invoice.getInvoiceNumber() + " (kỳ " + invoice.getPeriod() + ")"
                + (invoice.getRoomNumber() == null ? "" : " - Phòng " + invoice.getRoomNumber())
                + " đã quá hạn " + overdueDays + " ngày (hạn " + DATE.format(invoice.getDueDate()) + "). "
                + "Vui lòng thanh toán để tránh bị tạm ngưng tài khoản.";
        notificationService.publish(new NotificationPublishRequest(
                "DEBT_REMINDER:" + invoice.getId() + ":" + record.getReminderCount(),
                accountId, accountId, null, invoice.getBranchId(), "TENANT_DEBT", title, message,
                "/tenant/debts", clock.instant()));
    }

    /** Đóng các bản ghi đang mở mà hoá đơn đã thu đủ (ví dụ thanh toán qua cổng VNPay, ngoài job này). */
    private void settleClosedRecords(LocalDate today) {
        var open = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("isDeleted").is(false),
                Criteria.where("status").is(LatePaymentStatus.OPEN.name()))), LatePaymentRecord.class);
        for (LatePaymentRecord record : open) {
            Invoice invoice = record.getInvoiceId() == null ? null
                    : invoiceRepository.findByIdAndIsDeletedFalse(record.getInvoiceId()).orElse(null);
            if (invoice == null || invoice.getStatus() != InvoiceStatus.PAID) continue;
            record.setStatus(LatePaymentStatus.SETTLED);
            record.setSettledAt(clock.instant());
            record.setRemainingAmount(BigDecimal.ZERO);
            record.setPaidAmount(invoice.getPaidAmount());
            record.setLastEvaluatedAt(clock.instant());
            latePaymentRepository.save(record);
        }
    }
}
