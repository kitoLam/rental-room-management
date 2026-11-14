package com.kitolam.rentalroommanagement.modules.contract.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceReviewRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractRenewRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractTermRequest;
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
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
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

    @PatchMapping("/{id}/term")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<ContractResponse> chooseTerm(@PathVariable String id,
            @Valid @RequestBody ContractTermRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.chooseTerm(id, request.termMonths(), principal));
    }

    @GetMapping("/{id}/pdf")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<StandardResponse<String>> downloadPdf(@PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(StandardResponse.success(contractService.downloadPdf(id, principal)));
    }

    @GetMapping("/{id}/evidence/download")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<StandardResponse<String>> downloadSignedEvidence(@PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(StandardResponse.success(contractService.downloadSignedEvidence(id, principal)));
    }

    @PostMapping("/{id}/pdf/retry")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<String> retryPdf(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.retryPdf(id, principal));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo hợp đồng")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> create(@Valid @RequestBody ContractCreateRequest request) {
        return StandardResponse.success("Tạo hợp đồng thành công", contractService.create(request));
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

    @PostMapping("/{id}/evidence")
    @Operation(summary = "Tenant nộp bằng chứng hợp đồng đã ký")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<ContractResponse> submitEvidence(@PathVariable String id,
            @Valid @RequestBody ContractEvidenceRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.submitEvidence(id, request, principal));
    }

    @PostMapping("/{id}/evidence/review")
    @Operation(summary = "Manager/Admin duyệt hoặc yêu cầu gửi lại bằng chứng hợp đồng")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> reviewEvidence(@PathVariable String id,
            @Valid @RequestBody ContractEvidenceReviewRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.reviewEvidence(id, request, principal));
    }

    @PostMapping("/{id}/renew")
    @Operation(summary = "Gia hạn hợp đồng, tạo hợp đồng nối tiếp cho cùng chỗ ở")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public StandardResponse<ContractResponse> renew(@PathVariable String id,
            @Valid @RequestBody ContractRenewRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gia hạn hợp đồng", contractService.renew(id, request, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy hợp đồng theo id")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<ContractResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(contractService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang hợp đồng")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'MANAGER', 'ADMIN')")
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
