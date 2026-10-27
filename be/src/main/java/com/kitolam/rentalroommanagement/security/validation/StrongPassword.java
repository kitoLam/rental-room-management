package com.kitolam.rentalroommanagement.security.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = StrongPasswordValidator.class)
public @interface StrongPassword {
    String message() default "Mật khẩu cần ít nhất 8 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt và tối đa 72 byte UTF-8";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
