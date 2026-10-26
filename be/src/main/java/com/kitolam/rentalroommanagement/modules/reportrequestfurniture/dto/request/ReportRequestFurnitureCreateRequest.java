package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;

public record ReportRequestFurnitureCreateRequest(
        @NotBlank @ValidObjectId String reportRequestId,
        @NotBlank @ValidObjectId String furnitureId,
        String issueDescription
) {
}
