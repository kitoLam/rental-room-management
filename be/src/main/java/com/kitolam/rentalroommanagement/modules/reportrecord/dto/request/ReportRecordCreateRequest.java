package com.kitolam.rentalroommanagement.modules.reportrecord.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReportRecordCreateRequest(
        @NotBlank @ValidObjectId String reportRequestId,
        @ValidObjectId String managerId,
        @NotNull ReportRecordAction action,
        ReportRequestStatus statusFrom,
        ReportRequestStatus statusTo,
        String note,
        List<String> attachments
) {
}
