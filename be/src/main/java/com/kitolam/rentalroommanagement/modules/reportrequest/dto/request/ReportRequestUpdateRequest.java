package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record ReportRequestUpdateRequest(
        ReportRequestType type,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String title,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String content,
        List<String> attachments,
        ReportRequestPriority priority,
        String rejectReason,
        ReportRequestStatus status
) {
}
