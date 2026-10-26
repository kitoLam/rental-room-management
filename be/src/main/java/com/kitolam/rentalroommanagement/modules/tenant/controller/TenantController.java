package com.kitolam.rentalroommanagement.modules.tenant.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
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
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants")
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo người thuê")
    public StandardResponse<TenantResponse> create(@Valid @RequestBody TenantCreateRequest request) {
        return StandardResponse.success("Tạo người thuê thành công", tenantService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy người thuê theo id")
    public StandardResponse<TenantResponse> getById(@PathVariable String id) {
        return StandardResponse.success(tenantService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang người thuê")
    public StandardResponse<PagedResponse<TenantResponse>> search(
            @Valid @ParameterObject TenantFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(tenantService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật người thuê")
    public StandardResponse<TenantResponse> update(@PathVariable String id, @Valid @RequestBody TenantUpdateRequest request) {
        return StandardResponse.success("Cập nhật người thuê thành công", tenantService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm người thuê")
    public StandardResponse<Void> delete(@PathVariable String id) {
        tenantService.delete(id);
        return StandardResponse.success("Xoá người thuê thành công", null);
    }
}
