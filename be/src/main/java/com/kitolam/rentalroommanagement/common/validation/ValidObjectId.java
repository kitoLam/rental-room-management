package com.kitolam.rentalroommanagement.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.TYPE_USE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/** Null is valid; otherwise the value must be a 24-hex-char Mongo ObjectId. */
@Documented
@Constraint(validatedBy = ObjectIdValidator.class)
@Target({FIELD, METHOD, PARAMETER, TYPE_USE})
@Retention(RUNTIME)
public @interface ValidObjectId {

    String message() default "không phải ObjectId hợp lệ";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
