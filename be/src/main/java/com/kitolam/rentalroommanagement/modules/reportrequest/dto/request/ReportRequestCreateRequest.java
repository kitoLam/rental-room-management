package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReportRequestCreateRequest(
        String tenantId,
        @NotBlank String roomId,
        @NotNull ReportRequestType type,
        @NotBlank String title,
        @NotBlank String content,
        List<String> attachments,
        ReportRequestPriority priority,
        List<String> furnitureIds,
        List<String> serviceIds
) {
}
