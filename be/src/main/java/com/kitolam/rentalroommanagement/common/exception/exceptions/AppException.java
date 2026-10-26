package com.kitolam.rentalroommanagement.common.exception.exceptions;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base class for all business exceptions. Each subclass binds to one HTTP status,
 * so GlobalExceptionHandler only needs a single handler for the whole family.
 */
@Getter
public abstract class AppException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    protected AppException(HttpStatus status, String message) {
        this(status, message, (String) null);
    }

    protected AppException(HttpStatus status, String message, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    protected AppException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.errorCode = null;
    }
}
