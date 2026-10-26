package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TenantCreateRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        @NotBlank String phone,
        @NotBlank @Size(min = 6) String password,
        @Past LocalDate dateOfBirth,
        Gender gender,
        String idCardNumber,
        String address,
        String avatarUrl
) {
}
