package com.kitolam.rentalroommanagement.modules.branch.dto.response;

import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;

import java.time.Instant;

public record BranchResponse(
        String id,
        String name,
        String address,
        String phone,
        String email,
        String description,
        BranchStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
