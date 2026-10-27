package com.kitolam.rentalroommanagement.modules.auth.config;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import java.net.URI;
import java.time.Duration;

@Validated
@ConfigurationProperties("app.auth")
public record AuthProperties(
        @NotBlank String frontendUrl,
        @NotBlank @Email String mailFrom,
        @NotNull Duration verificationTokenTtl,
        @NotNull Duration resendCooldown) {
    @AssertTrue(message = "Thời hạn xác thực và thời gian chờ phải lớn hơn 0")
    public boolean isDurationValid() {
        return verificationTokenTtl != null && verificationTokenTtl.isPositive()
                && resendCooldown != null && resendCooldown.isPositive();
    }

    @AssertTrue(message = "FRONTEND_URL phải là URL HTTP(S), không có query hoặc fragment")
    public boolean isFrontendUrlValid() {
        try {
            URI uri = URI.create(frontendUrl);
            return ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null
                    && uri.getQuery() == null && uri.getFragment() == null;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
