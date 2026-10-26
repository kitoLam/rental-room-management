package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;

/** Query parameters for search; all optional. */
public record ContractFilterRequest(
        @ValidObjectId String roomId,
        @ValidObjectId String managerId,
        ContractStatus status,
        String keyword
) {
}
