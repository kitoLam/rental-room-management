package com.kitolam.rentalroommanagement.modules.contract.service.impl;

import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.support.ContractExpirySupport;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Nhắc tenant khi hợp đồng sắp hết hạn tại các mốc 45/30/21/14 ngày trước endDate.
 * Nếu bỏ lỡ nhiều mốc, chỉ gửi mốc gần nhất chưa gửi (không gửi dồn). Không gửi cho hợp đồng đã được gia hạn.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContractExpiryNotificationJob {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ContractRepository contractRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    @Scheduled(cron = "${contract.expiry-notify.cron:0 0 8 * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void notifyExpiringContracts() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ContractExpirySupport.VIETNAM_ZONE);
        int sent = notifyForDate(today);
        if (sent > 0) log.info("Sent {} contract expiry notifications", sent);
    }

    /** Public để chạy tay/kiểm thử. Trả về số thông báo đã gửi. */
    public int notifyForDate(LocalDate today) {
        int maxMilestone = ContractExpirySupport.EXPIRY_NOTIFY_MILESTONES[0]; // 45
        List<Contract> contracts = contractRepository.findByStatusAndEndDateBetweenAndIsDeletedFalse(
                ContractStatus.ACTIVE, today, today.plusDays(maxMilestone));
        int sent = 0;
        for (Contract contract : contracts) {
            // Bỏ qua hợp đồng đã được gia hạn (là gốc của một chuỗi nối tiếp).
            if (contract.getRenewedToContractId() != null) continue;
            long daysLeft = ChronoUnit.DAYS.between(today, contract.getEndDate());
            Integer milestone = pickMilestone(daysLeft, contract.getExpiryNotifiedMilestones());
            if (milestone == null) continue;
            if (publish(contract, milestone, daysLeft, today)) {
                List<Integer> notified = contract.getExpiryNotifiedMilestones() == null
                        ? new ArrayList<>() : new ArrayList<>(contract.getExpiryNotifiedMilestones());
                notified.add(milestone);
                contract.setExpiryNotifiedMilestones(notified);
                contractRepository.save(contract);
                sent++;
            }
        }
        return sent;
    }

    /** Mốc lớn nhất chưa gửi mà daysLeft đã chạm tới (daysLeft <= milestone). */
    private Integer pickMilestone(long daysLeft, List<Integer> alreadyNotified) {
        Integer picked = null;
        for (int milestone : ContractExpirySupport.EXPIRY_NOTIFY_MILESTONES) {
            if (alreadyNotified != null && alreadyNotified.contains(milestone)) continue;
            if (daysLeft <= milestone) picked = milestone;
        }
        return picked;
    }

    private boolean publish(Contract contract, int milestone, long daysLeft, LocalDate today) {
        String accountId = resolveTenantAccountId(contract.getTenantId());
        if (accountId == null) {
            log.warn("Skip contract expiry notification: tenant {} has no account", contract.getTenantId());
            return false;
        }
        String title = "Hợp đồng sắp hết hạn";
        String message = "Hợp đồng " + contract.getContractNumber() + " tại " + contract.getRoomAddress()
                + " sẽ hết hạn vào " + DATE.format(contract.getEndDate())
                + " (còn " + daysLeft + " ngày). Vui lòng liên hệ quản lý nếu muốn gia hạn.";
        String eventId = "CONTRACT_EXPIRY:" + contract.getId() + ":" + milestone;
        try {
            notificationService.publish(new NotificationPublishRequest(eventId, accountId,
                    accountId, null, null, "TENANT_CONTRACT", title, message,
                    "/user/contracts", clock.instant()));
            return true;
        } catch (RuntimeException failed) {
            log.warn("Contract expiry notification failed contract={}", contract.getId(), failed);
            return false;
        }
    }

    private String resolveTenantAccountId(String tenantId) {
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(tenantId).orElse(null);
        if (tenant == null || tenant.getEmail() == null) return null;
        return userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail())
                .map(user -> user.getId()).orElse(null);
    }
}
