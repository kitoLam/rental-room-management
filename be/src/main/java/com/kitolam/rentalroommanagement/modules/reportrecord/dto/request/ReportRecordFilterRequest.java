package com.kitolam.rentalroommanagement.modules.reportrecord.dto.request;

import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;

/** Query parameters for search; all optional. */
public record ReportRecordFilterRequest(
        String reportRequestId,
        String managerId,
        String actorId,
        ReportRecordAction action,
        ReportRequestStatus statusFrom,
        ReportRequestStatus statusTo
) {
}

