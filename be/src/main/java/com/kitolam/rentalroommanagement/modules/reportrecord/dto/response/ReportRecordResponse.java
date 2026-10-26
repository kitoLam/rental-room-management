package com.kitolam.rentalroommanagement.modules.reportrecord.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;

import java.time.Instant;
import java.util.List;

public record ReportRecordResponse(
        String id,
        String reportRequestId,
        String managerId,
        ReportRecordAction action,
        ReportRequestStatus statusFrom,
        ReportRequestStatus statusTo,
        String note,
        List<String> attachments,
        Instant createdAt,
        Instant updatedAt
) {
}
