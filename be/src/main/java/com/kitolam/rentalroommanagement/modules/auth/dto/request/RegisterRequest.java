package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Register a tenant account. Every field is required except avatarUrl and status
 * (status is always ACTIVE and role is always TENANT on register).
 */
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RegisterRequest {

    @NotBlank
    private String fullName;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String phone;

    @NotBlank
    @Size(min = 6)
    private String password;

    @NotNull
    @Past
    private LocalDate dateOfBirth;

    @NotNull
    private Gender gender;

    @NotBlank
    private String idCardNumber;

    @NotBlank
    private String address;
}
