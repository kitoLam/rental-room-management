package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
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

        @NotBlank(message = "Ngày tháng năm sinh không được để trống")
        @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$",
                message = "Ngày tháng năm sinh phải đúng định dạng yyyy-MM-dd")
        String dateOfBirth,

        @NotBlank(message = "Địa chỉ thường trú không được để trống")
        @Size(min = 5, max = 255, message = "Địa chỉ thường trú phải từ 5 đến 255 ký tự")
        String permanentAddress,

        @NotBlank(message = "Số CCCD không được để trống")
        @Pattern(regexp = "^[0-9]{9,12}$",
                message = "Số CCCD phải gồm 9 đến 12 chữ số")
        String cccdNumber,

        @NotBlank(message = "Ngày cấp CCCD không được để trống")
        @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$",
                message = "Ngày cấp CCCD phải đúng định dạng yyyy-MM-dd")
        String cccdIssueDate,

        @NotBlank(message = "Nơi cấp CCCD không được để trống")
        @Size(min = 2, max = 150, message = "Nơi cấp CCCD phải từ 2 đến 150 ký tự")
        String cccdIssuePlace,

        @NotBlank(message = "Ảnh mặt trước CCCD không được để trống")
        String cccdFrontImageUrl,

        @NotBlank(message = "Ảnh mặt sau CCCD không được để trống")
        String cccdBackImageUrl,

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
        dateOfBirth = dateOfBirth == null ? null : dateOfBirth.strip();
        permanentAddress = permanentAddress == null ? null : permanentAddress.strip();
        cccdNumber = cccdNumber == null ? null : cccdNumber.strip();
        cccdIssueDate = cccdIssueDate == null ? null : cccdIssueDate.strip();
        cccdIssuePlace = cccdIssuePlace == null ? null : cccdIssuePlace.strip();
        cccdFrontImageUrl = cccdFrontImageUrl == null ? null : cccdFrontImageUrl.strip();
        cccdBackImageUrl = cccdBackImageUrl == null ? null : cccdBackImageUrl.strip();
    }

    @JsonIgnore
    @AssertTrue(message = "Ngày tháng năm sinh không hợp lệ hoặc phải nhỏ hơn ngày hiện tại")
    public boolean isDateOfBirthValid() {
        if (dateOfBirth == null || dateOfBirth.isBlank() || !dateOfBirth.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return true;
        }
        try {
            return LocalDate.parse(dateOfBirth).isBefore(LocalDate.now());
        } catch (Exception ex) {
            return false;
        }
    }

    @JsonIgnore
    @AssertTrue(message = "Ngày cấp CCCD không hợp lệ, không được ở tương lai và phải sau ngày sinh")
    public boolean isCccdIssueDateValid() {
        if (cccdIssueDate == null || cccdIssueDate.isBlank() || !cccdIssueDate.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return true;
        }
        try {
            LocalDate issueDate = LocalDate.parse(cccdIssueDate);
            if (issueDate.isAfter(LocalDate.now())) {
                return false;
            }
            if (dateOfBirth != null && dateOfBirth.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
                LocalDate dob = LocalDate.parse(dateOfBirth);
                if (!issueDate.isAfter(dob)) {
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            return false;
        }
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
