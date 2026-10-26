package com.kitolam.rentalroommanagement.modules.branch.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record BranchCreateRequest(
        @NotBlank String name,
        @NotBlank String address,
        String phone,
        @Email String email,
        String description
) {
}
