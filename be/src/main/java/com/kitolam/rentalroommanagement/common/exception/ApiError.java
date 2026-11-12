package com.kitolam.rentalroommanagement.common.exception;

import java.time.Instant;

public record ApiError(int status, String message, Instant timestamp, String errorCode) {
    public ApiError(int status, String message, Instant timestamp) {
        this(status, message, timestamp, null);
    }
    public static ApiError of(int status, String message) {
        return new ApiError(status, message, Instant.now());
    }
    public static ApiError of(int status, String message, String errorCode) {
        return new ApiError(status, message, Instant.now(), errorCode);
    }
}
