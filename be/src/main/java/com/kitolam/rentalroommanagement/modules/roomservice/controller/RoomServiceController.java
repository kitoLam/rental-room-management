package com.kitolam.rentalroommanagement.modules.roomservice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceCatalogService;
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
@Tag(name = "Room Services")
public class RoomServiceController {

    private static final String STAFF = "hasAnyRole('OWNER', 'MANAGER', 'ADMIN')";

    private final RoomServiceCatalogService service;

    @PostMapping("/api/v1/room-services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(STAFF)
    @Operation(summary = "Tạo dịch vụ phòng")
    public StandardResponse<RoomServiceResponse> create(@Valid @RequestBody RoomServiceCreateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Tạo dịch vụ phòng thành công", service.create(request, principal));
    }

    @GetMapping("/api/v1/room-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Lấy dịch vụ phòng theo id")
    public StandardResponse<RoomServiceResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.getById(id, principal));
    }

    @GetMapping("/api/v1/room-services")
    @PreAuthorize(STAFF)
    @Operation(summary = "Danh sách dịch vụ phòng (theo chi nhánh bạn quản lý)")
    public StandardResponse<PagedResponse<RoomServiceResponse>> search(
            @Valid @ParameterObject RoomServiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "name", direction = Sort.Direction.ASC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.search(filter, pageable, principal));
    }

    @PatchMapping("/api/v1/room-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Cập nhật dịch vụ phòng")
    public StandardResponse<RoomServiceResponse> update(@PathVariable String id, @Valid @RequestBody RoomServiceUpdateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật dịch vụ phòng thành công", service.update(id, request, principal));
    }

    @DeleteMapping("/api/v1/room-services/{id}")
    @PreAuthorize(STAFF)
    @Operation(summary = "Xoá dịch vụ phòng")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        service.delete(id, principal);
        return StandardResponse.success("Xoá dịch vụ phòng thành công", null);
    }

    @GetMapping("/api/v1/public/branches/{branchId}/room-services")
    @Operation(summary = "Dịch vụ phòng đang áp dụng của chi nhánh (công khai)")
    public StandardResponse<List<RoomServiceResponse>> activeOfBranch(@PathVariable String branchId) {
        return StandardResponse.success(service.activeOfBranch(branchId));
    }
}
