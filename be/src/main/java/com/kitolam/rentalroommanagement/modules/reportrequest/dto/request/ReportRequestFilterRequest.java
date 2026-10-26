package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;

/** Query parameters for search; all optional. */
public record ReportRequestFilterRequest(
        @ValidObjectId String tenantId,
        @ValidObjectId String roomId,
        ReportRequestType type,
        ReportRequestPriority priority,
        ReportRequestStatus status,
        String keyword
) {
}
