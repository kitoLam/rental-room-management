package com.kitolam.rentalroommanagement.modules.roomtype.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.response.RoomTypeResponse;
import com.kitolam.rentalroommanagement.modules.roomtype.service.RoomTypeService;
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
@RequestMapping("/api/v1/room-types")
@RequiredArgsConstructor
@Tag(name = "Room Types")
public class RoomTypeController {

    private final RoomTypeService roomTypeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo loại phòng")
    public StandardResponse<RoomTypeResponse> create(@Valid @RequestBody RoomTypeCreateRequest request) {
        return StandardResponse.success("Tạo loại phòng thành công", roomTypeService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy loại phòng theo id")
    public StandardResponse<RoomTypeResponse> getById(@PathVariable String id) {
        return StandardResponse.success(roomTypeService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang loại phòng")
    public StandardResponse<PagedResponse<RoomTypeResponse>> search(
            @Valid @ParameterObject RoomTypeFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomTypeService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật loại phòng")
    public StandardResponse<RoomTypeResponse> update(@PathVariable String id, @Valid @RequestBody RoomTypeUpdateRequest request) {
        return StandardResponse.success("Cập nhật loại phòng thành công", roomTypeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm loại phòng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        roomTypeService.delete(id);
        return StandardResponse.success("Xoá loại phòng thành công", null);
    }
}
