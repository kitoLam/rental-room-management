package com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;

public record ReportRequestServiceItemCreateRequest(
        @NotBlank @ValidObjectId String reportRequestId,
        @NotBlank @ValidObjectId String roomServiceId,
        String note
) {
}
