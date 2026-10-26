package com.kitolam.rentalroommanagement.modules.contracttenant.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;

/** Query parameters for search; all optional. */
public record ContractTenantFilterRequest(
        @ValidObjectId String contractId,
        @ValidObjectId String tenantId,
        @ValidObjectId String bookingId,
        ContractTenantStatus status
) {
}
