package com.kitolam.rentalroommanagement.modules.room.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
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
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
@Tag(name = "Rooms")
public class RoomController {

    private final RoomService roomService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo phòng")
    public StandardResponse<RoomResponse> create(@Valid @RequestBody RoomCreateRequest request) {
        return StandardResponse.success("Tạo phòng thành công", roomService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy phòng theo id")
    public StandardResponse<RoomResponse> getById(@PathVariable String id) {
        return StandardResponse.success(roomService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang phòng")
    public StandardResponse<PagedResponse<RoomResponse>> search(
            @Valid @ParameterObject RoomFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật phòng")
    public StandardResponse<RoomResponse> update(@PathVariable String id, @Valid @RequestBody RoomUpdateRequest request) {
        return StandardResponse.success("Cập nhật phòng thành công", roomService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm phòng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        roomService.delete(id);
        return StandardResponse.success("Xoá phòng thành công", null);
    }
}
