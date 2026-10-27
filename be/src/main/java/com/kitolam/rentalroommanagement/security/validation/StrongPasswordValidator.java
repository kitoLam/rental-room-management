package com.kitolam.rentalroommanagement.security.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.codePointCount(0, value.length()) < 8
                || value.getBytes(StandardCharsets.UTF_8).length > 72) return false;
        return value.codePoints().anyMatch(Character::isUpperCase)
                && value.codePoints().anyMatch(Character::isLowerCase)
                && value.codePoints().anyMatch(Character::isDigit)
                && value.codePoints().anyMatch(c -> !Character.isLetterOrDigit(c) && !Character.isWhitespace(c))
                && value.codePoints().noneMatch(Character::isISOControl);
    }
}
