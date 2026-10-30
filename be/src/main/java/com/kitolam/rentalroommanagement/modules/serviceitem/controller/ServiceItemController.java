package com.kitolam.rentalroommanagement.modules.serviceitem.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
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
@RequestMapping("/api/v1/services")
@RequiredArgsConstructor
@Tag(name = "Services")
public class ServiceItemController {

    private static final String MANAGEMENT = "hasAnyRole('MANAGER', 'OWNER', 'ADMIN')";

    private final ServiceItemService serviceItemService;

    @PostMapping
    @PreAuthorize(MANAGEMENT)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo dịch vụ")
    public StandardResponse<ServiceItemResponse> create(@Valid @RequestBody ServiceItemCreateRequest request) {
        return StandardResponse.success("Tạo dịch vụ thành công", serviceItemService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy dịch vụ theo id")
    public StandardResponse<ServiceItemResponse> getById(@PathVariable @ValidObjectId String id) {
        return StandardResponse.success(serviceItemService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang dịch vụ")
    public StandardResponse<PagedResponse<ServiceItemResponse>> search(
            @Valid @ParameterObject ServiceItemFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(serviceItemService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Cập nhật dịch vụ; đổi status sang INACTIVE để ngừng nhận đăng ký mới")
    public StandardResponse<ServiceItemResponse> update(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody ServiceItemUpdateRequest request) {
        return StandardResponse.success("Cập nhật dịch vụ thành công", serviceItemService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Xoá mềm dịch vụ chưa được sử dụng")
    public StandardResponse<Void> delete(@PathVariable @ValidObjectId String id) {
        serviceItemService.delete(id);
        return StandardResponse.success("Xoá dịch vụ thành công", null);
    }
}
