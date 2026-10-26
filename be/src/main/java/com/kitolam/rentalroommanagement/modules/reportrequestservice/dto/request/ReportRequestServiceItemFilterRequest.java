package com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;

/** Query parameters for search; all optional. */
public record ReportRequestServiceItemFilterRequest(
        @ValidObjectId String reportRequestId,
        @ValidObjectId String roomServiceId
) {
}
