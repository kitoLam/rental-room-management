package com.kitolam.rentalroommanagement.modules.invoice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.ContractInvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceGenerateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.MyInvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceGenerationService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices")
public class InvoiceController {

    private static final String STAFF = "hasAnyRole('OWNER', 'MANAGER', 'ADMIN')";

    private final InvoiceService invoiceService;
    private final InvoiceGenerationService invoiceGenerationService;

    @PostMapping("/generate")
    @PreAuthorize(STAFF)
    @Operation(summary = "Tạo hoá đơn tháng (DRAFT) cho hợp đồng / phòng / tất cả hợp đồng; dryRun để xem trước")
    public StandardResponse<InvoiceGenerateResponse> generate(@Valid @RequestBody InvoiceGenerateRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceGenerationService.generate(request, principal));
    }

    @PostMapping("/contracts/{contractId}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Lập hoá đơn cho 1 hợp đồng trong 1 kỳ; chỉ thu phần chưa được lập hoá đơn trước đó")
    public StandardResponse<InvoiceResponse> createForContract(@PathVariable String contractId,
                                                               @Valid @RequestBody ContractInvoiceCreateRequest request,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Lập hoá đơn thành công",
                invoiceGenerationService.createForContract(contractId, request, principal));
    }

    @PatchMapping("/{id}/issue")
    @PreAuthorize(STAFF)
    @Operation(summary = "Phát hành hoá đơn (DRAFT → ISSUED) và gửi thông báo cho người thuê")
    public StandardResponse<InvoiceResponse> issue(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Phát hành hoá đơn thành công", invoiceService.issue(id, principal));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Hoá đơn của người thuê đang đăng nhập")
    public StandardResponse<PagedResponse<InvoiceResponse>> myInvoices(
            @Valid @ParameterObject MyInvoiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "period", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.myInvoices(filter, pageable, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy hoá đơn theo id")
    public StandardResponse<InvoiceResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.getById(id, principal));
    }

    @GetMapping
    @PreAuthorize(STAFF)
    @Operation(summary = "Tìm kiếm / phân trang hoá đơn")
    public StandardResponse<PagedResponse<InvoiceResponse>> search(
            @Valid @ParameterObject InvoiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(invoiceService.search(filter, pageable, principal));
    }

    @PatchMapping("/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Sửa các khoản thêm tay của hoá đơn DRAFT (phụ thu, giảm trừ...)")
    public StandardResponse<InvoiceResponse> update(@PathVariable String id, @Valid @RequestBody InvoiceUpdateRequest request,
                                                    @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật hoá đơn thành công", invoiceService.update(id, request, principal));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Xoá hoá đơn DRAFT")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        invoiceService.delete(id, principal);
        return StandardResponse.success("Xoá hoá đơn thành công", null);
    }
}
