package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ReportRequestAdminResolveRequest(
        @NotBlank(message = "Kết luận của Admin không được để trống")
        String adminConclusion
) {
}
