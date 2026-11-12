package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.document.ReportRequestFurniture;

import java.time.Instant;

public record ReportRequestFurnitureResponse(
        String id,
        String reportRequestId,
        String furnitureId,
        String issueDescription,
        Instant createdAt,
        Instant updatedAt
) {
    public static ReportRequestFurnitureResponse from(ReportRequestFurniture entity) {
        if (entity == null) {
            return null;
        }
        return new ReportRequestFurnitureResponse(
                entity.getId(),
                entity.getReportRequestId(),
                entity.getFurnitureId(),
                entity.getIssueDescription(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
