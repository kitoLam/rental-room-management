package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ReportRequestSupplementRequest(
        @NotBlank(message = "Nội dung bổ sung không được để trống")
        String additionalInfo,
        List<String> additionalAttachments
) {
}
