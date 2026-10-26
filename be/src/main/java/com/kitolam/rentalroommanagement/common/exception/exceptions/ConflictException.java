package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class ConflictException extends AppException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }

    public ConflictException(String message, String errorCode) {
        super(HttpStatus.CONFLICT, message, errorCode);
    }

    public ConflictException(String message, Throwable cause) {
        super(HttpStatus.CONFLICT, message, cause);
    }
}
