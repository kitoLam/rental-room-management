package com.kitolam.rentalroommanagement.modules.tenant.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.MessageResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantBranchStatusRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantBranchStatsResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
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
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants")
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Tạo tài khoản cho người thuê tại cơ sở và gửi liên kết xác thực qua email")
    public StandardResponse<TenantResponse> create(
            @Valid @RequestBody TenantCreateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(
                "Đã tạo tài khoản người thuê và gửi liên kết xác thực qua email",
                tenantService.create(request, principal));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Thống kê số lượng người thuê / quản lý trong phạm vi cơ sở")
    public StandardResponse<TenantBranchStatsResponse> stats(
            @RequestParam(required = false) String branchId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantService.stats(branchId, principal));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Lấy thông tin cơ bản của người thuê theo id trong phạm vi cơ sở")
    public StandardResponse<TenantResponse> getById(
            @PathVariable String id,
            @RequestParam(required = false) String branchId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantService.getById(id, branchId, principal));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Tìm kiếm / phân trang tài khoản thuộc cơ sở quản lý")
    public StandardResponse<PagedResponse<TenantResponse>> search(
            @Valid @ParameterObject TenantFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantService.search(filter, pageable, principal));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Cập nhật thông tin cơ bản của người thuê")
    public StandardResponse<TenantResponse> update(
            @PathVariable String id,
            @Valid @RequestBody TenantUpdateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật người thuê thành công", tenantService.update(id, request, principal));
    }

    @PatchMapping("/{id}/branch-status")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Active / Inactive tài khoản trong phạm vi cơ sở")
    public StandardResponse<TenantResponse> updateBranchStatus(
            @PathVariable String id,
            @Valid @RequestBody TenantBranchStatusRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(
                "Cập nhật trạng thái tài khoản tại cơ sở thành công",
                tenantService.updateBranchStatus(id, request, principal));
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Nâng hoặc hạ vai trò giữa TENANT và MANAGER trong cơ sở thuộc quyền sở hữu của Owner")
    public StandardResponse<TenantResponse> updateRole(
            @PathVariable String id,
            @Valid @RequestBody TenantRoleUpdateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(
                "Cập nhật vai trò thành công",
                tenantService.updateRole(id, request, principal));
    }

    @PostMapping("/{id}/resend-verification")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Gửi lại liên kết xác thực và đặt mật khẩu cho người thuê")
    public StandardResponse<MessageResponse> resendVerification(
            @PathVariable String id,
            @RequestParam(required = false) String branchId,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantService.resendVerification(id, branchId, principal));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    @Operation(summary = "Vô hiệu hóa người thuê trong phạm vi cơ sở")
    public StandardResponse<Void> delete(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        tenantService.delete(id, principal);
        return StandardResponse.success("Đã ngừng hoạt động người thuê tại cơ sở", null);
    }
}
