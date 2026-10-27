package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RefreshTokenRequest(
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9_-]{43}$", message = "Refresh token không đúng định dạng")
        String refreshToken) {
    @Override
    public String toString() { return "RefreshTokenRequest[REDACTED]"; }
}
