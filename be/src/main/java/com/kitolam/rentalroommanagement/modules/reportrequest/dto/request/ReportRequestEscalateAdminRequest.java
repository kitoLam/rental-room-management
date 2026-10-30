package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ReportRequestEscalateAdminRequest(
        @NotBlank(message = "Lý do chuyển Admin / nội dung tranh chấp không được để trống")
        String disputeReason
) {
}
