package com.kitolam.rentalroommanagement.modules.branch.dto.request;

import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;

/** Query parameters for search; all optional. */
public record BranchFilterRequest(
        BranchStatus status,
        String keyword
) {
}
