package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.common.exception.exceptions.AppException;
import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.context.event.EventListener;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@RequiredArgsConstructor
public class VerificationMailService {
    private final JavaMailSender sender;
    private final AuthProperties properties;

    // SMTP runs only after Mongo commits, so every delivered link refers to persisted data.
    @EventListener
    public void schedule(VerificationMailEvent event) {
        // afterCommit propagates SMTP failures to the HTTP caller; the account remains persisted.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { send(event); }
        });
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
            sender.send(mail);
        } catch (MailException ex) {
            // Do not log SMTP exceptions: providers may embed recipients or message contents.
            throw new MailDeliveryException();
        }
    }

    public static class MailDeliveryException extends AppException {
        public MailDeliveryException() {
            super(HttpStatus.SERVICE_UNAVAILABLE,
                    "Đã lưu yêu cầu nhưng chưa gửi được email. Vui lòng gửi lại email xác thực sau thời gian chờ");
        }
    }
}
