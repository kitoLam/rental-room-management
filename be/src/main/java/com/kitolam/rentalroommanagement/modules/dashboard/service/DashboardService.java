package com.kitolam.rentalroommanagement.modules.dashboard.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementOverviewResponse;
import java.time.YearMonth;

public interface DashboardService {
    ManagementOverviewResponse management(AuthPrincipal principal, String branchId, YearMonth month, int expiringPage);
    ManagementOverviewResponse management(AuthPrincipal principal, String branchId, YearMonth month, int expiringPage, int activityPage);
}
