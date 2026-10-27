package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;

import java.util.Locale;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SignupRequest(
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

        @NotBlank(message = "Mật khẩu không được để trống")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,72}$",
                message = "Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt")
        String password,

        @NotBlank(message = "Xác nhận mật khẩu không được để trống")
        @Size(max = 72, message = "Xác nhận mật khẩu không được vượt quá 72 ký tự")
        String confirmPassword,

        @NotNull(message = "Bạn phải đồng ý điều khoản")
        @AssertTrue(message = "Bạn phải đồng ý điều khoản sử dụng")
        Boolean termsAccepted
) {
    public SignupRequest {
        fullName = fullName == null ? null : fullName.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        phone = phone == null ? null : phone.strip();
        if (phone != null && phone.startsWith("+84")) phone = "0" + phone.substring(3);
    }

    @JsonIgnore
    @AssertTrue(message = "Mật khẩu xác nhận không khớp")
    public boolean isPasswordMatching() {
        return password != null && password.equals(confirmPassword);
    }

    @Override
    public String toString() {
        return "SignupRequest[REDACTED]";
    }
}
