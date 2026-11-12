package com.kitolam.rentalroommanagement.common.exception;

import com.kitolam.rentalroommanagement.common.exception.exceptions.AppException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.TransactionException;
import org.springframework.validation.BindException;
import org.springframework.web.*;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> unauthorized(AuthenticationException ex) {
        return error(401, "Bạn cần đăng nhập");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> forbidden(AccessDeniedException ex) {
        return error(403, "Bạn không có quyền truy cập tài nguyên này");
    }
    private ResponseEntity<ApiError> error(int status, String message) {
        return ResponseEntity.status(status).body(ApiError.of(status, message));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiError> business(AppException ex) {
        return ResponseEntity.status(ex.getStatus()).body(ApiError.of(ex.getStatus().value(), ex.getMessage(), ex.getErrorCode()));
    }

    @ExceptionHandler({BindException.class, org.springframework.web.bind.MethodArgumentNotValidException.class})
    public ResponseEntity<ApiError> validation(BindException ex) {
        String message = ex.getBindingResult().getAllErrors().stream()
                .map(e -> e.getDefaultMessage() == null ? "Dữ liệu không hợp lệ" : e.getDefaultMessage())
                .distinct().sorted().collect(java.util.stream.Collectors.joining("; "));
        return error(400, message);
    }

    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class})
    public ResponseEntity<ApiError> constraints(Exception ex) {
        return error(400, "Tham số không hợp lệ hoặc token không đúng định dạng");
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiError> duplicate(DuplicateKeyException ex) {
        String msg = ex.getMessage();
        if (msg != null && msg.contains("phone")) {
            return error(409, "Số điện thoại này đã được sử dụng. Vui lòng chọn số khác.");
        }
        if (msg != null && msg.contains("email")) {
            return error(409, "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.");
        }
        return error(409, "Thông tin tài khoản (email hoặc số điện thoại) đã tồn tại.");
    }

    @ExceptionHandler({TransientDataAccessException.class, TransactionException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ApiError> concurrent(Exception ex) {
        return error(409, "Yêu cầu xung đột hoặc transaction chưa hoàn tất. Vui lòng thử lại");
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(Exception ex) {
        // Parser exception messages can contain passwords, raw tokens or request fragments.
        return error(400, "Dữ liệu yêu cầu không hợp lệ hoặc thiếu tham số bắt buộc");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> method(HttpRequestMethodNotSupportedException ex) {
        return error(405, "HTTP method không được hỗ trợ");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> mediaType(HttpMediaTypeNotSupportedException ex) {
        return error(415, "Content-Type không được hỗ trợ");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> missing(NoResourceFoundException ex) {
        return error(404, "Không tìm thấy tài nguyên");
    }

    @ExceptionHandler(UnsupportedOperationException.class)
    public ResponseEntity<ApiError> unimplemented(UnsupportedOperationException ex) {
        return error(501, "Chức năng chưa được triển khai");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception ex) {
        log.error("Unhandled exception type={}", ex.getClass().getName());
        return error(500, "Lỗi hệ thống, vui lòng thử lại sau");
    }
}
