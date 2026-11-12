package com.kitolam.rentalroommanagement.modules.slotservice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceCatalogService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Slot Services")
public class SlotServiceController {

    private static final String STAFF = "hasAnyRole('OWNER', 'MANAGER', 'ADMIN')";

    private final SlotServiceCatalogService service;

    @PostMapping("/api/v1/slot-services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(STAFF)
    @Operation(summary = "Tạo dịch vụ tự chọn")
    public StandardResponse<SlotServiceResponse> create(@Valid @RequestBody SlotServiceCreateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Tạo dịch vụ tự chọn thành công", service.create(request, principal));
    }

    @GetMapping("/api/v1/slot-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Lấy dịch vụ tự chọn theo id")
    public StandardResponse<SlotServiceResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.getById(id, principal));
    }

    @GetMapping("/api/v1/slot-services")
    @PreAuthorize(STAFF)
    @Operation(summary = "Danh sách dịch vụ tự chọn (theo chi nhánh bạn quản lý)")
    public StandardResponse<PagedResponse<SlotServiceResponse>> search(
            @Valid @ParameterObject SlotServiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "name", direction = Sort.Direction.ASC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.search(filter, pageable, principal));
    }

    @PatchMapping("/api/v1/slot-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Cập nhật dịch vụ tự chọn")
    public StandardResponse<SlotServiceResponse> update(@PathVariable String id, @Valid @RequestBody SlotServiceUpdateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật dịch vụ tự chọn thành công", service.update(id, request, principal));
    }

    @DeleteMapping("/api/v1/slot-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Xoá dịch vụ tự chọn")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        service.delete(id, principal);
        return StandardResponse.success("Xoá dịch vụ tự chọn thành công", null);
    }

    @GetMapping("/api/v1/public/branches/{branchId}/slot-services")
    @Operation(summary = "Dịch vụ tự chọn đang áp dụng của chi nhánh (công khai)")
    public StandardResponse<List<SlotServiceResponse>> activeOfBranch(@PathVariable String branchId) {
        return StandardResponse.success(service.activeOfBranch(branchId));
    }
}
