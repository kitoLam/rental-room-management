package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.response.RoomSlotOccupancyResponse;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
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
@RequestMapping("/api/v1/room-slot-occupancies")
@RequiredArgsConstructor
@Tag(name = "Room Slot Occupancies")
public class RoomSlotOccupancyController {

    private final RoomSlotOccupancyService roomSlotOccupancyService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo lượt ở")
    public StandardResponse<RoomSlotOccupancyResponse> create(@Valid @RequestBody RoomSlotOccupancyCreateRequest request) {
        return StandardResponse.success("Tạo lượt ở thành công", roomSlotOccupancyService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy lượt ở theo id")
    public StandardResponse<RoomSlotOccupancyResponse> getById(@PathVariable String id) {
        return StandardResponse.success(roomSlotOccupancyService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang lượt ở")
    public StandardResponse<PagedResponse<RoomSlotOccupancyResponse>> search(
            @Valid @ParameterObject RoomSlotOccupancyFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomSlotOccupancyService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật lượt ở")
    public StandardResponse<RoomSlotOccupancyResponse> update(@PathVariable String id, @Valid @RequestBody RoomSlotOccupancyUpdateRequest request) {
        return StandardResponse.success("Cập nhật lượt ở thành công", roomSlotOccupancyService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm lượt ở")
    public StandardResponse<Void> delete(@PathVariable String id) {
        roomSlotOccupancyService.delete(id);
        return StandardResponse.success("Xoá lượt ở thành công", null);
    }
}
