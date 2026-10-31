package com.kitolam.rentalroommanagement.modules.contract.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractDraftRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/v1/contracts")
@RequiredArgsConstructor
@Tag(name = "Contracts")
public class ContractController {

    private final ContractService contractService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo hợp đồng")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> create(@Valid @RequestBody ContractCreateRequest request) {
        return StandardResponse.success("Tạo hợp đồng thành công", contractService.create(request));
    }

    @PostMapping("/from-booking/{bookingId}")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo hợp đồng nháp từ booking đã nộp cọc")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> createDraftFromBooking(@PathVariable String bookingId,
            @Valid @RequestBody ContractDraftRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã tạo hợp đồng nháp", contractService.createDraftFromBooking(bookingId, request, principal));
    }

    @PatchMapping("/{id}/services")
    @Operation(summary = "Tenant chọn dịch vụ tùy chọn trong hợp đồng nháp")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<ContractResponse> selectServices(@PathVariable String id,
            @RequestBody ContractServiceSelectionRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.selectServices(id, request, principal));
    }

    @PostMapping("/{id}/check-in")
    @Operation(summary = "Owner/Manager bàn giao phòng và lưu hợp đồng đã ký giấy")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> completeCheckIn(@PathVariable String id,
            @Valid @RequestBody ContractCheckInRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.completeCheckIn(id, request, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy hợp đồng theo id")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang hợp đồng")
    public StandardResponse<PagedResponse<ContractResponse>> search(
            @Valid @ParameterObject ContractFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.search(filter, pageable, principal));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật hợp đồng")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> update(@PathVariable String id, @Valid @RequestBody ContractUpdateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật hợp đồng thành công", contractService.update(id, request, principal));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm hợp đồng")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        contractService.delete(id, principal);
        return StandardResponse.success("Xoá hợp đồng thành công", null);
    }
}
