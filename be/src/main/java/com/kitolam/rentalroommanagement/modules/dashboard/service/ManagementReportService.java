package com.kitolam.rentalroommanagement.modules.dashboard.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.request.ManagementReportRequest;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementReportResponse;

public interface ManagementReportService {
    ManagementReportResponse report(AuthPrincipal principal, ManagementReportRequest request);
}
