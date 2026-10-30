package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ReportRequestInfoRequest(
        @NotBlank(message = "Nội dung yêu cầu bổ sung không được để trống")
        String note
) {
}
