package com.kitolam.rentalroommanagement.modules.dashboard.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.AdminOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.AdminOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminDashboardController {
    private final AdminOverviewService overview;

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public StandardResponse<AdminOverviewResponse> dashboard(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Integer year) {
        return StandardResponse.success(overview.overview(principal, year));
    }
}
