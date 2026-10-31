package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;

/** Query parameters for search; all optional. */
public record ReportRequestFilterRequest(
        String tenantId,
        String roomId,
        String branchId,
        String contractId,
        String managerId,
        ReportRequestType type,
        ReportRequestPriority priority,
        ReportRequestStatus status,
        String keyword
) {
}

