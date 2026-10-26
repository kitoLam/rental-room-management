package com.kitolam.rentalroommanagement.modules.invoice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
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
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo hoá đơn")
    public StandardResponse<InvoiceResponse> create(@Valid @RequestBody InvoiceCreateRequest request) {
        return StandardResponse.success("Tạo hoá đơn thành công", invoiceService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy hoá đơn theo id")
    public StandardResponse<InvoiceResponse> getById(@PathVariable String id) {
        return StandardResponse.success(invoiceService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang hoá đơn")
    public StandardResponse<PagedResponse<InvoiceResponse>> search(
            @Valid @ParameterObject InvoiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(invoiceService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật hoá đơn")
    public StandardResponse<InvoiceResponse> update(@PathVariable String id, @Valid @RequestBody InvoiceUpdateRequest request) {
        return StandardResponse.success("Cập nhật hoá đơn thành công", invoiceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm hoá đơn")
    public StandardResponse<Void> delete(@PathVariable String id) {
        invoiceService.delete(id);
        return StandardResponse.success("Xoá hoá đơn thành công", null);
    }
}
