package com.kitolam.rentalroommanagement.common.exception.exceptions;

import org.springframework.http.HttpStatus;

public class TooManyRequestsException extends AppException {
    public TooManyRequestsException(String message) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    public TooManyRequestsException(String message, String errorCode) {
        super(HttpStatus.TOO_MANY_REQUESTS, message, errorCode);
    }

    public TooManyRequestsException(String message, Throwable cause) {
        super(HttpStatus.TOO_MANY_REQUESTS, message, cause);
    }
}
