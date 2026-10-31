package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReportRequestProgressRequest(
        @NotBlank(message = "Nội dung cập nhật tiến độ không được để trống")
        @Size(min = 3, max = 2000, message = "Nội dung tiến độ cần từ 3 đến 2000 ký tự")
        String progressNote,
        @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
        List<String> attachments
) {
}
