package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Email cảnh cáo khi hoá đơn quá hạn. Gửi ngay trong lượt của job, lỗi SMTP chỉ bị ghi log. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DebtReminderMailService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat MONEY = NumberFormat.getInstance(Locale.of("vi", "VN"));

    private final JavaMailSender sender;
    private final AuthProperties properties;

    public record DebtReminderMail(String email, String tenantName, String roomNumber, String branchName,
                                   String invoiceNumber, String period, LocalDate dueDate, long overdueDays,
                                   BigDecimal remainingAmount) {
    }

    /** @return true khi SMTP đã nhận thư; false khi thiếu địa chỉ hoặc gửi lỗi. */
    public boolean send(DebtReminderMail mail) {
        if (mail.email() == null || mail.email().isBlank()) return false;
        var message = new SimpleMailMessage();
        message.setFrom(properties.mailFrom());
        message.setTo(mail.email());
        message.setSubject("Cảnh báo công nợ quá hạn - Hoá đơn " + mail.invoiceNumber());
        message.setText(body(mail));
        try {
            sender.send(message);
            log.info("Đã gửi nhắc nợ hoá đơn {} tới {}", mail.invoiceNumber(), mail.email());
            return true;
        } catch (MailException ex) {
            log.warn("Không gửi được email nhắc nợ hoá đơn {}: {}", mail.invoiceNumber(), ex.getMessage());
            return false;
        }
    }

    private String body(DebtReminderMail mail) {
        String tenant = mail.tenantName() == null || mail.tenantName().isBlank() ? "Quý khách" : mail.tenantName();
        String room = mail.roomNumber() == null ? "" : " - Phòng " + mail.roomNumber();
        String branch = mail.branchName() == null ? "" : " tại " + mail.branchName();
        return "Kính gửi " + tenant + ",\n\n"
                + "Hoá đơn " + mail.invoiceNumber() + " (kỳ " + mail.period() + ")" + room + branch
                + " đã quá hạn thanh toán " + mail.overdueDays() + " ngày.\n"
                + "Hạn thanh toán: " + DATE.format(mail.dueDate()) + "\n"
                + "Số tiền còn nợ: " + MONEY.format(mail.remainingAmount()) + " VND\n\n"
                + "Vui lòng thanh toán công nợ để tránh bị tạm ngưng tài khoản và không thể đặt phòng tại cơ sở.\n"
                + "Nếu bạn đã thanh toán, hãy bỏ qua email này hoặc liên hệ quản lý để đối chiếu.\n\n"
                + "Trân trọng,\nRental Room Management";
    }
}
