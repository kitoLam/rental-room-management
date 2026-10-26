package com.kitolam.rentalroommanagement.modules.tenant.dto.response;

import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;

import java.time.Instant;
import java.time.LocalDate;

public record TenantResponse(
        String id,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        Gender gender,
        String idCardNumber,
        String address,
        String avatarUrl,
        TenantStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
