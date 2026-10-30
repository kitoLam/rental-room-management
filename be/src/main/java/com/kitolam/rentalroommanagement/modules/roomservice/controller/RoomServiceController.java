package com.kitolam.rentalroommanagement.modules.roomservice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceService;
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
@RequestMapping("/api/v1/room-services")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MANAGER', 'OWNER', 'ADMIN')")
@Tag(name = "Room Services", description = "Dịch vụ đang dùng của phòng; tạo / ngừng qua /api/v1/service-requests")
public class RoomServiceController {

    private final RoomServiceService roomServiceService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo dịch vụ phòng")
    public StandardResponse<RoomServiceResponse> create(@Valid @RequestBody RoomServiceCreateRequest request) {
        return StandardResponse.success("Tạo dịch vụ phòng thành công", roomServiceService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy dịch vụ phòng theo id")
    public StandardResponse<RoomServiceResponse> getById(@PathVariable @ValidObjectId String id) {
        return StandardResponse.success(roomServiceService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang dịch vụ phòng")
    public StandardResponse<PagedResponse<RoomServiceResponse>> search(
            @Valid @ParameterObject RoomServiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomServiceService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật dịch vụ phòng")
    public StandardResponse<RoomServiceResponse> update(@PathVariable @ValidObjectId String id, @Valid @RequestBody RoomServiceUpdateRequest request) {
        return StandardResponse.success("Cập nhật dịch vụ phòng thành công", roomServiceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm dịch vụ phòng")
    public StandardResponse<Void> delete(@PathVariable @ValidObjectId String id) {
        roomServiceService.delete(id);
        return StandardResponse.success("Xoá dịch vụ phòng thành công", null);
    }
}
