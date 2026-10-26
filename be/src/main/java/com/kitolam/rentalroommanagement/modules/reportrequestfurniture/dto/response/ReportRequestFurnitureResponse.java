package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response;

import java.time.Instant;

public record ReportRequestFurnitureResponse(
        String id,
        String reportRequestId,
        String furnitureId,
        String issueDescription,
        Instant createdAt,
        Instant updatedAt
) {
}
