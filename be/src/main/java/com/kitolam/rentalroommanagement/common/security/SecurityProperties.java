package com.kitolam.rentalroommanagement.common.security;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import java.time.Duration;
import java.util.List;

@Validated
@ConfigurationProperties("app.security")
public record SecurityProperties(
        @NotBlank String jwtSecret,
        @NotBlank String issuer,
        @NotBlank String audience,
        @NotNull Duration accessTokenTtl,
        @NotNull Duration refreshTokenTtl,
        @NotEmpty List<@NotBlank String> allowedOrigins,
        boolean requireHttps,
        boolean publicDocs,
        @Min(10) @Max(16) int bcryptStrength) {
    @Override
    public String toString() { return "SecurityProperties[REDACTED]"; }

    @AssertTrue(message = "Token TTL phải lớn hơn 0")
    public boolean isTtlValid() {
        return accessTokenTtl != null && !accessTokenTtl.isNegative() && !accessTokenTtl.isZero()
                && refreshTokenTtl != null && !refreshTokenTtl.isNegative() && !refreshTokenTtl.isZero();
    }
}
