package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ReportRequestReopenRequest(
        @NotBlank(message = "Lý do mở lại không được để trống")
        String reason
) {
}
