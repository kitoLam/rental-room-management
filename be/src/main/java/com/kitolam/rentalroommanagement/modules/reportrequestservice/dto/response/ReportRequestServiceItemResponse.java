package com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrequestservice.document.ReportRequestServiceItem;

import java.time.Instant;

public record ReportRequestServiceItemResponse(
        String id,
        String reportRequestId,
        String roomServiceId,
        String note,
        Instant createdAt,
        Instant updatedAt
) {
    public static ReportRequestServiceItemResponse from(ReportRequestServiceItem entity) {
        if (entity == null) {
            return null;
        }
        return new ReportRequestServiceItemResponse(
                entity.getId(),
                entity.getReportRequestId(),
                entity.getRoomServiceId(),
                entity.getNote(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
