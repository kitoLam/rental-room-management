package com.kitolam.rentalroommanagement.modules.reportrequest.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ReportRequestResolveRequest(
        @NotBlank(message = "Kết quả giải quyết không được để trống")
        String solutionResult,
        List<String> attachments
) {
}
