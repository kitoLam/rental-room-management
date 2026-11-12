package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TenantRoleUpdateRequest(
        @NotBlank(message = "Vai trò không được để trống")
        @Pattern(regexp = "^(TENANT|MANAGER)$", message = "Vai trò chỉ nhận TENANT hoặc MANAGER")
        String role,
        String branchId
) {
    public TenantRoleUpdateRequest {
        role = role == null ? null : role.strip().toUpperCase();
        branchId = (branchId == null || branchId.isBlank()) ? null : branchId.strip();
    }
}
