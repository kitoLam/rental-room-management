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
import com.kitolam.rentalroommanagement.modules.room.dto.request.SlotAvailableFromRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomSlotUsageResponse;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomUtilityRatesResponse;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
@Tag(name = "Rooms")
public class RoomController {

    private final RoomService roomService;

    @GetMapping("/{id}/utility-rates")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public StandardResponse<RoomUtilityRatesResponse> utilityRates(@PathVariable @ValidObjectId String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(roomService.utilityRateConfiguration(id, principal));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Tạo phòng (kèm maxOccupants chỗ ở)")
    public StandardResponse<RoomResponse> create(@Valid @RequestBody RoomCreateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Tạo phòng thành công", roomService.create(request, principal));
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
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Cập nhật phòng")
    public StandardResponse<RoomResponse> update(@PathVariable String id, @Valid @RequestBody RoomUpdateRequest request,
                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật phòng thành công", roomService.update(id, request, principal));
    }

    @GetMapping("/{id}/slots")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Danh sách chỗ ở của phòng kèm tình trạng đang bận")
    public StandardResponse<List<RoomSlotUsageResponse>> slots(@PathVariable @ValidObjectId String id,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(roomService.slots(id, principal));
    }

    @PatchMapping("/{id}/slots/{slotId}/available-from")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Chỉnh ngày bắt đầu cho thuê của một chỗ còn trống")
    public StandardResponse<RoomSlotUsageResponse> updateSlotAvailableFrom(
            @PathVariable @ValidObjectId String id, @PathVariable @ValidObjectId String slotId,
            @Valid @RequestBody SlotAvailableFromRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã cập nhật ngày bắt đầu cho thuê",
                roomService.updateSlotAvailableFrom(id, slotId, request.availableFrom(), principal));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    @Operation(summary = "Xoá mềm phòng")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        roomService.delete(id, principal);
        return StandardResponse.success("Xoá phòng thành công", null);
    }
}
