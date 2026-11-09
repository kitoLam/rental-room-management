package com.kitolam.rentalroommanagement.modules.reportrequest.dto.response;

import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.document.ReportRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;

import java.time.Instant;
import java.util.List;

public record ReportRequestResponse(
        String id,
        String tenantId,
        String roomId,
        String roomName,
        String slotName,
        String branchId,
        String contractId,
        String managerId,
        String assigneeName,
        String assigneePhone,
        ReportRequestType type,
        String title,
        String content,
        List<String> attachments,
        ReportRequestPriority priority,
        String rejectReason,
        String requestedInfoNote,
        String solutionResult,
        String disputeReason,
        String adminConclusion,
        ReportRequestStatus status,
        Instant resolvedAt,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        List<ReportRecordResponse> timeline
) {
    public static ReportRequestResponse from(ReportRequest r) {
        return from(r, null, null, null, null, null);
    }

    public static ReportRequestResponse from(ReportRequest r, List<ReportRecordResponse> timeline) {
        return from(r, timeline, null, null, null, null);
    }

    public static ReportRequestResponse from(
            ReportRequest r,
            List<ReportRecordResponse> timeline,
            String roomName,
            String slotName
    ) {
        return from(r, timeline, roomName, slotName, r != null ? r.getAssigneeName() : null, r != null ? r.getAssigneePhone() : null);
    }

    public static ReportRequestResponse from(
            ReportRequest r,
            List<ReportRecordResponse> timeline,
            String roomName,
            String slotName,
            String assigneeName,
            String assigneePhone
    ) {
        if (r == null) {
            return null;
        }
        return new ReportRequestResponse(
                r.getId(),
                r.getTenantId(),
                r.getRoomId(),
                roomName,
                slotName,
                r.getBranchId(),
                r.getContractId(),
                r.getManagerId(),
                assigneeName,
                assigneePhone,
                r.getType(),
                r.getTitle(),
                r.getContent(),
                r.getAttachments() != null ? r.getAttachments() : List.of(),
                r.getPriority(),
                r.getRejectReason(),
                r.getRequestedInfoNote(),
                r.getSolutionResult(),
                r.getDisputeReason(),
                r.getAdminConclusion(),
                r.getStatus(),
                r.getResolvedAt(),
                r.getClosedAt(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                timeline != null ? timeline : List.of()
        );
    }
}
