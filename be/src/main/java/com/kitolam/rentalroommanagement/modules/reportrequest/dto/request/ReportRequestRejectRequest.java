package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ReportRequestRejectRequest(
        @NotBlank(message = "Lý do từ chối không được để trống")
        String reason
) {
}
