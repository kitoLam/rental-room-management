package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TenantBranchStatusRequest(
        String branchId,
        @NotNull(message = "Trạng thái không được để trống")
        TenantStatus status
) {
    public TenantBranchStatusRequest {
        branchId = (branchId == null || branchId.isBlank()) ? null : branchId.strip();
    }
}

