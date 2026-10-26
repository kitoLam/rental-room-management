package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;

/** Query parameters for search; all optional. */
public record TenantFilterRequest(
        TenantStatus status,
        String keyword
) {
}
