package com.kitolam.rentalroommanagement.modules.manager.dto.response;

import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;

import java.time.Instant;
import java.util.List;

public record ManagerResponse(
        String id,
        String branchId,
        String fullName,
        String email,
        String phone,
        List<String> permissions,
        ManagerStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
