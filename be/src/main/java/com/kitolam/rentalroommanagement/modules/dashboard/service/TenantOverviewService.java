package com.kitolam.rentalroommanagement.modules.dashboard.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.TenantOverviewResponse;
import java.util.List;

public interface TenantOverviewService {
    List<TenantOverviewResponse.Lease> tenancies(AuthPrincipal principal);
    TenantOverviewResponse overview(AuthPrincipal principal, String tenancyId);
}
