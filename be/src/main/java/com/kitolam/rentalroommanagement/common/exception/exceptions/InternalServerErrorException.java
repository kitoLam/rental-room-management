package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class InternalServerErrorException extends AppException {
    public InternalServerErrorException(String message) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    public InternalServerErrorException(String message, String errorCode) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, message, errorCode);
    }

    public InternalServerErrorException(String message, Throwable cause) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, message, cause);
    }
}
