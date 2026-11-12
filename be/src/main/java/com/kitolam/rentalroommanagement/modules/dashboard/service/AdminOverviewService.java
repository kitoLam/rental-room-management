package com.kitolam.rentalroommanagement.modules.dashboard.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.AdminOverviewResponse;

public interface AdminOverviewService {
    AdminOverviewResponse overview(AuthPrincipal principal, Integer year);
}
