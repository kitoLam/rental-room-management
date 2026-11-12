package com.kitolam.rentalroommanagement.modules.dashboard.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.DashboardService;
import com.kitolam.rentalroommanagement.modules.dashboard.service.ManagementReportService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.request.ManagementReportRequest;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementReportResponse;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Validated
public class DashboardController {
    private final DashboardService dashboardService;
    private final ManagementReportService managementReportService;

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public StandardResponse<ManagementReportResponse> reports(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @ModelAttribute ManagementReportRequest request) {
        return StandardResponse.success(managementReportService.report(principal, request));
    }

    @GetMapping("/management")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public StandardResponse<ManagementOverviewResponse> management(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @ValidObjectId String branchId,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "0") int expiringPage,
            @RequestParam(defaultValue = "0") int activityPage) {
        YearMonth period = null;
        if (month != null) {
            try { period = YearMonth.parse(month); }
            catch (DateTimeParseException exception) {
                throw new BadRequestException("Tháng phải có định dạng yyyy-MM");
            }
        }
        return StandardResponse.success(dashboardService.management(principal, branchId, period, expiringPage, activityPage));
    }
}
