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

        @Pattern(regexp = "^(MALE|FEMALE|OTHER)?$", message = "Giới tính không hợp lệ")
        String gender,

        @Size(min = 5, max = 255, message = "Địa chỉ thường trú phải từ 5 đến 255 ký tự")
        String permanentAddress,

        @Pattern(regexp = "^[0-9]{12}$", message = "Số CCCD phải gồm đúng 12 chữ số")
        String cccdNumber,

        String cccdIssueDate,

        @Size(min = 2, max = 150, message = "Nơi cấp CCCD phải từ 2 đến 150 ký tự")
        String cccdIssuePlace
) {
    public UpdateProfileRequest {
        permanentAddress = optionalText(permanentAddress);
        cccdNumber = optionalText(cccdNumber);
        cccdIssueDate = optionalText(cccdIssueDate);
        cccdIssuePlace = optionalText(cccdIssuePlace);
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

    private static String optionalText(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    @Override
    public String toString() {
        return "UpdateProfileRequest[REDACTED]";
    }
}
