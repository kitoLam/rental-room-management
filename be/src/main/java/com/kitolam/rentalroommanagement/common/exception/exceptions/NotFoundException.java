package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class NotFoundException extends AppException {
    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }

    public NotFoundException(String message, String errorCode) {
        super(HttpStatus.NOT_FOUND, message, errorCode);
    }

    public NotFoundException(String message, Throwable cause) {
        super(HttpStatus.NOT_FOUND, message, cause);
    }
}
