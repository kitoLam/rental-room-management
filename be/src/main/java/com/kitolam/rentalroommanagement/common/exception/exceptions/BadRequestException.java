package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class BadRequestException extends AppException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }

    public BadRequestException(String message, String errorCode) {
        super(HttpStatus.BAD_REQUEST, message, errorCode);
    }

    public BadRequestException(String message, Throwable cause) {
        super(HttpStatus.BAD_REQUEST, message, cause);
    }
}
