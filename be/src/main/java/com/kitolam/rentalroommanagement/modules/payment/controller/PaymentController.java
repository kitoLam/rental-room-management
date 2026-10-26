package com.kitolam.rentalroommanagement.modules.payment.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentCreateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentFilterRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.response.PaymentResponse;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payments")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo thanh toán")
    public StandardResponse<PaymentResponse> create(@Valid @RequestBody PaymentCreateRequest request) {
        return StandardResponse.success("Tạo thanh toán thành công", paymentService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy thanh toán theo id")
    public StandardResponse<PaymentResponse> getById(@PathVariable String id) {
        return StandardResponse.success(paymentService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang thanh toán")
    public StandardResponse<PagedResponse<PaymentResponse>> search(
            @Valid @ParameterObject PaymentFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(paymentService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật thanh toán")
    public StandardResponse<PaymentResponse> update(@PathVariable String id, @Valid @RequestBody PaymentUpdateRequest request) {
        return StandardResponse.success("Cập nhật thanh toán thành công", paymentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm thanh toán")
    public StandardResponse<Void> delete(@PathVariable String id) {
        paymentService.delete(id);
        return StandardResponse.success("Xoá thanh toán thành công", null);
    }
}
