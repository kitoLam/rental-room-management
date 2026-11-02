package com.kitolam.rentalroommanagement.modules.reportrecord.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrecord.document.ReportRecord;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;

import java.time.Instant;
import java.util.List;

public record ReportRecordResponse(
        String id,
        String reportRequestId,
        String actorId,
        String actorRole,
        String actorName,
        String managerId,
        ReportRecordAction action,
        ReportRequestStatus statusFrom,
        ReportRequestStatus statusTo,
        String note,
        List<String> attachments,
        Instant createdAt,
        Instant updatedAt
) {
    public static ReportRecordResponse from(ReportRecord record) {
        if (record == null) {
            return null;
        }
        return new ReportRecordResponse(
                record.getId(),
                record.getReportRequestId(),
                record.getActorId(),
                record.getActorRole(),
                record.getActorName(),
                record.getManagerId(),
                record.getAction(),
                record.getStatusFrom(),
                record.getStatusTo(),
                record.getNote(),
                record.getAttachments() != null ? record.getAttachments() : List.of(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
