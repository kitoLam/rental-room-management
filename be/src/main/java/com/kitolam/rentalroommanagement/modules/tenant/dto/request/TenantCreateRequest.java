package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Locale;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TenantCreateRequest(
        @NotBlank(message = "Họ và tên không được để trống")
        @Size(max = 100, message = "Họ và tên không được vượt quá 100 ký tự")
        String fullName,

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không đúng định dạng")
        @Size(max = 254, message = "Email không được vượt quá 254 ký tự")
        String email,

        @NotBlank(message = "Số điện thoại không được để trống")
        @Pattern(regexp = "^0[35789][0-9]{8}$",
                message = "Số di động Việt Nam phải gồm 10 số, đầu 03/05/07/08/09")
        String phone,

        String branchId,

        @Past(message = "Ngày sinh phải trong quá khứ")
        LocalDate dateOfBirth,

        Gender gender,

        String avatarUrl
) {
    public TenantCreateRequest {
        fullName = fullName == null ? null : fullName.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        phone = phone == null ? null : phone.strip();
        if (phone != null && phone.startsWith("+84")) {
            phone = "0" + phone.substring(3);
        }
        branchId = (branchId == null || branchId.isBlank()) ? null : branchId.strip();
    }
}
