package com.kitolam.rentalroommanagement.modules.dashboard.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.DebtItemResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.DebtOverviewService;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.DashboardService;
import com.kitolam.rentalroommanagement.modules.dashboard.service.ManagementReportService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.request.ManagementReportRequest;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementReportResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.TenantOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.TenantOverviewService;
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
    private final TenantOverviewService tenantOverviewService;
    private final DebtOverviewService debtOverviewService;

    @GetMapping("/tenant/tenancies")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<java.util.List<TenantOverviewResponse.Lease>> tenantTenancies(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantOverviewService.tenancies(principal));
    }

    @GetMapping("/tenant")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<TenantOverviewResponse> tenant(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @ValidObjectId String tenancyId) {
        return StandardResponse.success(tenantOverviewService.overview(principal, tenancyId));
    }

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public StandardResponse<ManagementReportResponse> reports(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @ModelAttribute ManagementReportRequest request) {
        return StandardResponse.success(managementReportService.report(principal, request));
    }

    @GetMapping("/debts")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public StandardResponse<PagedResponse<DebtItemResponse>> debts(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @ValidObjectId String branchId,
            @RequestParam(required = false) @ValidObjectId String roomId,
            @RequestParam(required = false) @ValidObjectId String contractTenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "8") int size) {
        return StandardResponse.success(debtOverviewService.debts(principal, branchId, roomId, contractTenantId,
                keyword, overdueOnly, page, size));
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
