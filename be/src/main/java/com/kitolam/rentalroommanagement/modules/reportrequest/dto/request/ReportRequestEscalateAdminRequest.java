package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReportRequestEscalateAdminRequest(
        @NotBlank(message = "Lý do chuyển Admin / nội dung tranh chấp không được để trống")
        @Size(min = 5, max = 2000, message = "Nội dung tranh chấp cần từ 5 đến 2000 ký tự")
        String disputeReason,
        @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
        List<String> attachments
) {
    public ReportRequestEscalateAdminRequest(String disputeReason) {
        this(disputeReason, List.of());
    }
}
