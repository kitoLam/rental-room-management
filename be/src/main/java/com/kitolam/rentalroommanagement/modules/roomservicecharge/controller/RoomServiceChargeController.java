package com.kitolam.rentalroommanagement.modules.roomservicecharge.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.RoomServiceChargeResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.service.RoomServiceChargeService;
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

@RestController
@RequestMapping("/api/v1/room-service-charges")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
@Tag(name = "Room Service Charges")
public class RoomServiceChargeController {

    private final RoomServiceChargeService roomServiceChargeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Nhập chỉ số điện/nước của phòng cho một kỳ")
    public StandardResponse<RoomServiceChargeResponse> create(@Valid @RequestBody RoomServiceChargeCreateRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Nhập chỉ số thành công", roomServiceChargeService.create(request, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chỉ số theo id")
    public StandardResponse<RoomServiceChargeResponse> getById(@PathVariable String id,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(roomServiceChargeService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang chỉ số")
    public StandardResponse<PagedResponse<RoomServiceChargeResponse>> search(
            @Valid @ParameterObject RoomServiceChargeFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(roomServiceChargeService.search(filter, pageable, principal));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Sửa chỉ số (chỉ khi còn DRAFT)")
    public StandardResponse<RoomServiceChargeResponse> update(@PathVariable String id,
                                                              @Valid @RequestBody RoomServiceChargeUpdateRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật chỉ số thành công", roomServiceChargeService.update(id, request, principal));
    }

    @PatchMapping("/{id}/confirm")
    @Operation(summary = "Chốt chỉ số (DRAFT → CONFIRMED) để dùng khi tạo hoá đơn")
    public StandardResponse<RoomServiceChargeResponse> confirm(@PathVariable String id,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Chốt chỉ số thành công", roomServiceChargeService.confirm(id, principal));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá chỉ số (chỉ khi còn DRAFT)")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        roomServiceChargeService.delete(id, principal);
        return StandardResponse.success("Xoá chỉ số thành công", null);
    }
}
