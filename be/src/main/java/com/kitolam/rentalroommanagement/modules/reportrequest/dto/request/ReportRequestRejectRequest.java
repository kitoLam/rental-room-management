package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportRequestRejectRequest(
        @NotBlank(message = "Lý do từ chối không được để trống")
        @Size(min = 3, max = 2000, message = "Lý do từ chối cần từ 3 đến 2000 ký tự")
        String reason
) {
}
