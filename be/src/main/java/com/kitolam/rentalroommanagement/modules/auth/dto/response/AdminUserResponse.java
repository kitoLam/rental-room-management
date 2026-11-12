package com.kitolam.rentalroommanagement.modules.auth.dto.response;

import java.time.Instant;

public record AdminUserResponse(String id, String fullName, String email, String phone, String role,
        String status, boolean emailVerified, Instant createdAt) {
}
