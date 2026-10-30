package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReportRequestResolveRequest(
        @NotBlank(message = "Kết quả giải quyết không được để trống")
        @Size(min = 5, max = 2000, message = "Kết quả giải quyết cần từ 5 đến 2000 ký tự")
        String solutionResult,
        @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
        List<String> attachments
) {
}
