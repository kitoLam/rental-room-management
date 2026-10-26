package com.kitolam.rentalroommanagement.modules.branch.dto.request;

import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;

/** PATCH semantics: null fields are left unchanged. */
public record BranchUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String name,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String address,
        String phone,
        @Email String email,
        String description,
        BranchStatus status
) {
}
