package com.kitolam.rentalroommanagement.modules.tenant.dto.response;

public record TenantBranchStatsResponse(
        String branchId,
        long totalTenants,
        long totalManagers,
        long activeTenants,
        long inactiveTenants,
        long pendingVerificationTenants
) {
}
