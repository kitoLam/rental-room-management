package com.kitolam.rentalroommanagement.modules.manager.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record ManagerUpdateRequest(
        @ValidObjectId String branchId,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String fullName,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Email String email,
        String phone,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(min = 6) String password,
        List<String> permissions,
        ManagerStatus status
) {
}
