package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UpdateProfileRequest(
        @NotBlank(message = "Họ và tên không được để trống")
        @Size(max = 100, message = "Họ và tên tối đa 100 ký tự")
        String fullName,

        @Pattern(regexp = "^(0[0-9]{9})?$", message = "Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 0)")
        String phone,

        String dateOfBirth,

        String gender
) {
    public UpdateProfileRequest {
        fullName = fullName == null ? null : fullName.strip();
        if (phone != null) {
            phone = phone.replaceAll("\\s+", "").strip();
            if (phone.startsWith("+84")) {
                phone = "0" + phone.substring(3);
            }
            if (phone.isBlank()) {
                phone = null;
            }
        }
    }
}
