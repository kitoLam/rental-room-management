package com.kitolam.rentalroommanagement.modules.manager.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ManagerCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank String fullName,
        @NotBlank @Email String email,
        String phone,
        @NotBlank @Size(min = 6) String password,
        List<String> permissions
) {
}
