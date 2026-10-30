package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportRequestInfoRequest(
        @NotBlank(message = "Nội dung yêu cầu bổ sung không được để trống")
        @Size(min = 3, max = 2000, message = "Nội dung yêu cầu bổ sung cần từ 3 đến 2000 ký tự")
        String note
) {
}
