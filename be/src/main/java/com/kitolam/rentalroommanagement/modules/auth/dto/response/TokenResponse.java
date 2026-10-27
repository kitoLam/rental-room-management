package com.kitolam.rentalroommanagement.modules.auth.dto.response;

public record TokenResponse(String accessToken, String refreshToken, String tokenType,
                            long expiresIn, long refreshExpiresIn) {
    @Override
    public String toString() { return "TokenResponse[REDACTED]"; }
}
