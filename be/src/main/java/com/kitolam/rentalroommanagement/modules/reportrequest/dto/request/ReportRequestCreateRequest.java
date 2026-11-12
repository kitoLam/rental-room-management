package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReportRequestCreateRequest(
        String tenantId,
        @NotBlank(message = "Phòng không được để trống")
        String roomId,
        @NotNull(message = "Loại yêu cầu không được để trống")
        ReportRequestType type,
        @NotBlank(message = "Tiêu đề không được để trống")
        @Size(min = 3, max = 120, message = "Tiêu đề cần từ 3 đến 120 ký tự")
        String title,
        @NotBlank(message = "Nội dung mô tả không được để trống")
        @Size(min = 5, max = 2000, message = "Nội dung cần từ 5 đến 2000 ký tự")
        String content,
        @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
        List<String> attachments,
        ReportRequestPriority priority,
        List<String> furnitureIds,
        List<String> serviceIds
) {
}
