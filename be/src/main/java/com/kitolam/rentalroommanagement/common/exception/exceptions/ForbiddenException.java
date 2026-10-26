package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends AppException {
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }

    public ForbiddenException(String message, String errorCode) {
        super(HttpStatus.FORBIDDEN, message, errorCode);
    }

    public ForbiddenException(String message, Throwable cause) {
        super(HttpStatus.FORBIDDEN, message, cause);
    }
}
