package com.kitolam.rentalroommanagement.modules.reportrecord.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;

/** Query parameters for search; all optional. */
public record ReportRecordFilterRequest(
        @ValidObjectId String reportRequestId,
        @ValidObjectId String managerId,
        ReportRecordAction action
) {
}
