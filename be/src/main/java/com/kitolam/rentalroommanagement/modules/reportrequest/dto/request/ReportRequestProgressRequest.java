package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ReportRequestProgressRequest(
        @NotBlank(message = "Nội dung cập nhật tiến độ không được để trống")
        String progressNote,
        List<String> attachments
) {
}
