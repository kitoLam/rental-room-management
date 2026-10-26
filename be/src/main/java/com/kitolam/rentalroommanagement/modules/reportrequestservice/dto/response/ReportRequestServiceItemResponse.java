package com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response;

import java.time.Instant;

public record ReportRequestServiceItemResponse(
        String id,
        String reportRequestId,
        String roomServiceId,
        String note,
        Instant createdAt,
        Instant updatedAt
) {
}
