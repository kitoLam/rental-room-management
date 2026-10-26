package com.kitolam.rentalroommanagement.common.base;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StandardResponse<T> {

    @Builder.Default
    private boolean success = true;

    @Builder.Default
    private Object message = "Thành công";

    private T data;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    private String errorCode;

    public static <T> StandardResponse<T> success() {
        return StandardResponse.<T>builder().build();
    }

    public static <T> StandardResponse<T> success(T data) {
        return StandardResponse.<T>builder()
                .data(data)
                .build();
    }

    public static <T> StandardResponse<T> success(String message, T data) {
        return StandardResponse.<T>builder()
                .message(message)
                .data(data)
                .build();
    }

    public static <T> StandardResponse<T> successWithoutMessage(T data) {
        return StandardResponse.<T>builder()
                .message(null)
                .data(data)
                .build();
    }

    public static <T> StandardResponse<T> error(Object message) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }

    public static <T> StandardResponse<T> error(String message, String errorCode) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(message)
                .errorCode(errorCode)
                .build();
    }

    public static <T> StandardResponse<T> error(String message, T data) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(message)
                .data(data)
                .build();
    }
}
