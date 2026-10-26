package com.kitolam.rentalroommanagement.modules.reportrequest.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;

import java.time.Instant;
import java.util.List;

public record ReportRequestResponse(
        String id,
        String tenantId,
        String roomId,
        ReportRequestType type,
        String title,
        String content,
        List<String> attachments,
        ReportRequestPriority priority,
        String rejectReason,
        ReportRequestStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
