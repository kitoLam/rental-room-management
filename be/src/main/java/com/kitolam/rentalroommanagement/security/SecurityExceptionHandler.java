package com.kitolam.rentalroommanagement.security;

import com.kitolam.rentalroommanagement.common.exception.ApiError;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityExceptionHandler {
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> unauthorized(AuthenticationException ex) {
        return ResponseEntity.status(401).body(ApiError.of(401, "Bạn cần đăng nhập"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> forbidden(AccessDeniedException ex) {
        return ResponseEntity.status(403).body(ApiError.of(403, "Bạn không có quyền truy cập tài nguyên này"));
    }
}
