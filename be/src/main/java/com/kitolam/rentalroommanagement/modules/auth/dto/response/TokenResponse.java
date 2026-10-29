package com.kitolam.rentalroommanagement.modules.auth.dto.response;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        long refreshExpiresIn,
        String accountId,
        String email,
        String fullName,
        String role,
        String phone
) {
    public TokenResponse(String accessToken, String refreshToken, String tokenType,
                         long expiresIn, long refreshExpiresIn) {
        this(accessToken, refreshToken, tokenType, expiresIn, refreshExpiresIn, null, null, null, null, null);
    }

    public TokenResponse(String accessToken, String refreshToken, String tokenType,
                         long expiresIn, long refreshExpiresIn,
                         String accountId, String email, String fullName, String role) {
        this(accessToken, refreshToken, tokenType, expiresIn, refreshExpiresIn, accountId, email, fullName, role, null);
    }

    @Override
    public String toString() {
        return "TokenResponse[REDACTED]";
    }
}
