package com.kitolam.rentalroommanagement.modules.invoice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceConfirmRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceConfirmResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceEstimateResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.invoice.service.impl.InvoiceGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices")
public class InvoiceController {

    private static final String PERIOD = "^\\d{4}-(0[1-9]|1[0-2])$";

    private final InvoiceService invoiceService;
    private final InvoiceGenerationService generationService;

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Hoá đơn của chi nhánh trong một tháng")
    public StandardResponse<List<InvoiceResponse>> list(
            @RequestParam @ValidObjectId String branchId,
            @RequestParam @Pattern(regexp = PERIOD, message = "định dạng yyyy-MM") String period,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.listForBranch(branchId, period, principal));
    }

    @GetMapping("/estimate")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Ước tính hoá đơn tháng cho các slot chưa có hoá đơn (không lưu)")
    public StandardResponse<InvoiceEstimateResponse> estimate(
            @RequestParam @ValidObjectId String branchId,
            @RequestParam @Pattern(regexp = PERIOD, message = "định dạng yyyy-MM") String period,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(generationService.estimate(branchId, period, principal));
    }

    @PostMapping("/estimate/confirm")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Xác nhận tạo hoá đơn từ ước tính (các slot đã có hoá đơn tháng đó được bỏ qua)")
    public StandardResponse<InvoiceConfirmResponse> confirm(@Valid @RequestBody InvoiceConfirmRequest request,
                                                            @AuthenticationPrincipal AuthPrincipal principal) {
        InvoiceConfirmResponse result = generationService.confirm(request.branchId(), request.period(), request.contractIds(), principal);
        return StandardResponse.success("Đã tạo " + result.created().size() + " hoá đơn", result);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Hoá đơn của người thuê đang đăng nhập")
    public StandardResponse<PagedResponse<InvoiceResponse>> my(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.my(principal, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết hoá đơn")
    public StandardResponse<InvoiceResponse> getById(@PathVariable @ValidObjectId String id,
                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.getById(id, principal));
    }
}
