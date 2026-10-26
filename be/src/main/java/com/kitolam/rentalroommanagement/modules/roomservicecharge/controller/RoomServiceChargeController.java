package com.kitolam.rentalroommanagement.modules.roomservicecharge.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
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
@Tag(name = "Room Service Charges")
public class RoomServiceChargeController {

    private final RoomServiceChargeService roomServiceChargeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo phí dịch vụ phòng")
    public StandardResponse<RoomServiceChargeResponse> create(@Valid @RequestBody RoomServiceChargeCreateRequest request) {
        return StandardResponse.success("Tạo phí dịch vụ phòng thành công", roomServiceChargeService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy phí dịch vụ phòng theo id")
    public StandardResponse<RoomServiceChargeResponse> getById(@PathVariable String id) {
        return StandardResponse.success(roomServiceChargeService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang phí dịch vụ phòng")
    public StandardResponse<PagedResponse<RoomServiceChargeResponse>> search(
            @Valid @ParameterObject RoomServiceChargeFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(roomServiceChargeService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật phí dịch vụ phòng")
    public StandardResponse<RoomServiceChargeResponse> update(@PathVariable String id, @Valid @RequestBody RoomServiceChargeUpdateRequest request) {
        return StandardResponse.success("Cập nhật phí dịch vụ phòng thành công", roomServiceChargeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm phí dịch vụ phòng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        roomServiceChargeService.delete(id);
        return StandardResponse.success("Xoá phí dịch vụ phòng thành công", null);
    }
}
