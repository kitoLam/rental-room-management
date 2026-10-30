package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReportRequestReopenRequest(
        @NotBlank(message = "Lý do mở lại không được để trống")
        @Size(min = 3, max = 2000, message = "Lý do mở lại cần từ 3 đến 2000 ký tự")
        String reason,
        @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
        List<String> attachments
) {
    public ReportRequestReopenRequest(String reason) {
        this(reason, List.of());
    }
}
