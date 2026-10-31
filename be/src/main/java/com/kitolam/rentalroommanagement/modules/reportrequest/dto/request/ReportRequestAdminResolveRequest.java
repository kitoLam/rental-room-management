package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportRequestAdminResolveRequest(
        @NotBlank(message = "Kết luận của Admin không được để trống")
        @Size(min = 5, max = 2000, message = "Kết luận của Admin cần từ 5 đến 2000 ký tự")
        String adminConclusion
) {
}
