package com.kitolam.rentalroommanagement.modules.tenant.dto.response;

import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Basic account view for Manager/Owner.
 * Never exposes passwordHash, verification tokens, idCardNumber, or permanent address.
 */
public record TenantResponse(
        String id,
        String userId,
        String fullName,
        String email,
        String phone,
        String role,
        LocalDate dateOfBirth,
        Gender gender,
        String avatarUrl,
        TenantStatus status,
        String accountStatus,
        boolean emailVerified,
        boolean passwordSet,
        List<String> branchIds,
        List<String> branchNames,
        List<String> inactiveBranchIds,
        String currentRoomNumber,
        Instant createdAt,
        Instant updatedAt
) {
}
