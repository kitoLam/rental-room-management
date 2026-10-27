package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kitolam.rentalroommanagement.security.validation.StrongPassword;
import jakarta.validation.constraints.*;
import java.util.Locale;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SignupRequest(
        @NotBlank @Size(max = 100) String fullName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^0[35789][0-9]{8}$",
                message = "Số di động Việt Nam phải gồm 10 số, đầu 03/05/07/08/09 hoặc +84 tương ứng") String phone,
        @StrongPassword String password,
        @NotBlank @Size(max = 72) String confirmPassword,
        @NotNull @AssertTrue(message = "Bạn phải đồng ý điều khoản") Boolean termsAccepted) {
    public SignupRequest {
        fullName = fullName == null ? null : fullName.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        phone = phone == null ? null : phone.strip();
        if (phone != null && phone.startsWith("+84")) phone = "0" + phone.substring(3);
    }

    @JsonIgnore
    @AssertTrue(message = "Nhập lại mật khẩu không khớp")
    public boolean isPasswordMatching() {
        return password != null && password.equals(confirmPassword);
    }

    @Override
    public String toString() { return "SignupRequest[REDACTED]"; }
}
