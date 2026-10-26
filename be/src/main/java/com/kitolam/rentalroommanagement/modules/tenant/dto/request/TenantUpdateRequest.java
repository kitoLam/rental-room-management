package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record TenantUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String fullName,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Email String email,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String phone,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(min = 6) String password,
        @Past LocalDate dateOfBirth,
        Gender gender,
        String idCardNumber,
        String address,
        String avatarUrl,
        TenantStatus status
) {
}
