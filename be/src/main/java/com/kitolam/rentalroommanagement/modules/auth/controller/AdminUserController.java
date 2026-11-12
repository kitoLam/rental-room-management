package com.kitolam.rentalroommanagement.modules.auth.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserFilterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminRoleResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminUserResponse;
import com.kitolam.rentalroommanagement.modules.auth.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Validated
@Tag(name = "Admin users")
public class AdminUserController {
    private final AdminUserService adminUsers;

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Danh sách người dùng toàn hệ thống, lọc theo vai trò / từ khóa")
    public StandardResponse<PagedResponse<AdminUserResponse>> users(
            @ParameterObject AdminUserFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(adminUsers.search(filter, pageable, principal));
    }

    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Đổi vai trò: Tenant → Owner hoặc Manager → Tenant")
    public StandardResponse<AdminUserResponse> updateRole(
            @PathVariable @ValidObjectId String id,
            @Valid @RequestBody AdminUserRoleUpdateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật vai trò thành công", adminUsers.updateRole(id, request, principal));
    }

    @GetMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Danh sách vai trò và số tài khoản")
    public StandardResponse<List<AdminRoleResponse>> roles(@AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(adminUsers.roles(principal));
    }
}
