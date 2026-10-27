package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.common.exception.exceptions.AppException;
import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationMailService {
    private final JavaMailSender sender;
    private final AuthProperties properties;

    @EventListener
    public void schedule(VerificationMailEvent event) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(event);
                }
            });
        } else {
            send(event);
        }
    }

    private void send(VerificationMailEvent event) {
        String link = UriComponentsBuilder.fromUriString(properties.frontendUrl())
                .pathSegment("verify-email").queryParam("token", event.token()).build().toUriString();
        var mail = new SimpleMailMessage();
        mail.setFrom(properties.mailFrom());
        mail.setTo(event.email());
        mail.setSubject("Xác thực email - Rental Room Management");
        mail.setText("Vui lòng xác thực email bằng liên kết sau:\n" + link
                + "\n\nLiên kết có hiệu lực trong " + properties.verificationTokenTtl().toHours()
                + " giờ. Nếu bạn không đăng ký, hãy bỏ qua email này.");
        try {
            log.info("Đang gửi email xác thực đến: {}", event.email());
            sender.send(mail);
            log.info("Gửi email xác thực thành công đến: {}", event.email());
        } catch (MailException ex) {
            log.error("Lỗi khi gửi email xác thực đến {}: {}", event.email(), ex.getMessage(), ex);
            throw new MailDeliveryException();
        }
    }

    public static class MailDeliveryException extends AppException {
        public MailDeliveryException() {
            super(HttpStatus.SERVICE_UNAVAILABLE,
                    "Đã lưu yêu cầu nhưng chưa gửi được email. Vui lòng kiểm tra cấu hình SMTP hoặc gửi lại sau");
        }
    }
}
