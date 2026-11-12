package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.Size;

public record ReportRequestAssignRequest(
        @Size(max = 120, message = "Tên người phụ trách tối đa 120 ký tự")
        String assigneeName,
        @Size(max = 30, message = "Số điện thoại tối đa 30 ký tự")
        String assigneePhone,
        String managerId
) {
}
