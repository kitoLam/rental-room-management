package com.kitolam.rentalroommanagement.modules.manager.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;

/** Query parameters for search; all optional. */
public record ManagerFilterRequest(
        @ValidObjectId String branchId,
        ManagerStatus status,
        String keyword
) {
}
