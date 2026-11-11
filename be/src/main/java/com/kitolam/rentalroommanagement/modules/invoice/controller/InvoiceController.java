package com.kitolam.rentalroommanagement.modules.invoice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtResponse;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping("/debts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','TENANT','ADMIN')")
    @Operation(summary = "Danh sách công nợ & đóng trễ hạn của người thuê")
    public StandardResponse<PagedResponse<TenantDebtResponse>> listDebts(
            @RequestParam(required = false) String branchId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            @RequestParam(required = false) String period,
            @ParameterObject @PageableDefault(size = 10) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return StandardResponse.success(
                invoiceService.listDebts(branchId, keyword, overdueOnly, period, pageable, principal)
        );
    }

    @PostMapping("/debts/{debtId}/pay")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','TENANT','ADMIN')")
    @Operation(summary = "Thanh toán toàn bộ công nợ của người thuê")
    public StandardResponse<TenantDebtResponse> payDebt(
            @PathVariable String debtId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return StandardResponse.success(
                "Thanh toán toàn bộ công nợ thành công",
                invoiceService.payDebt(debtId, principal)
        );
    }

    @PostMapping("/debts/{debtId}/unpay")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Đặt lại trạng thái chưa thanh toán (dùng để kiểm thử công nợ quá hạn)")
    public StandardResponse<TenantDebtResponse> unpayDebt(
            @PathVariable String debtId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return StandardResponse.success(
                "Đã đặt lại trạng thái chưa thanh toán",
                invoiceService.unpayDebt(debtId, principal)
        );
    }

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
