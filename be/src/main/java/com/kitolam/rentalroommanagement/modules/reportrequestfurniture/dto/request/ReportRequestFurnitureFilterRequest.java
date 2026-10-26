package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;

/** Query parameters for search; all optional. */
public record ReportRequestFurnitureFilterRequest(
        @ValidObjectId String reportRequestId,
        @ValidObjectId String furnitureId
) {
}
