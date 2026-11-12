package com.kitolam.rentalroommanagement.modules.dashboard.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.DebtItemResponse;

public interface DebtOverviewService {
    /** Outstanding invoices in the principal's branch scope, 1-based page, most overdue first. */
    PagedResponse<DebtItemResponse> debts(AuthPrincipal principal, String branchId, String roomId,
            String contractTenantId, String keyword, boolean overdueOnly, int page, int size);
}
