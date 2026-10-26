package com.kitolam.rentalroommanagement.modules.roomslot.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.response.RoomSlotResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
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
@RequestMapping("/api/v1/room-slots")
@RequiredArgsConstructor
@Tag(name = "Room Slots")
public class RoomSlotController {

    private final RoomSlotService roomSlotService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo chỗ ở")
    public StandardResponse<RoomSlotResponse> create(@Valid @RequestBody RoomSlotCreateRequest request) {
        return StandardResponse.success("Tạo chỗ ở thành công", roomSlotService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chỗ ở theo id")
    public StandardResponse<RoomSlotResponse> getById(@PathVariable String id) {
        return StandardResponse.success(roomSlotService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang chỗ ở")
    public StandardResponse<PagedResponse<RoomSlotResponse>> search(
            @Valid @ParameterObject RoomSlotFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomSlotService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật chỗ ở")
    public StandardResponse<RoomSlotResponse> update(@PathVariable String id, @Valid @RequestBody RoomSlotUpdateRequest request) {
        return StandardResponse.success("Cập nhật chỗ ở thành công", roomSlotService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm chỗ ở")
    public StandardResponse<Void> delete(@PathVariable String id) {
        roomSlotService.delete(id);
        return StandardResponse.success("Xoá chỗ ở thành công", null);
    }
}
