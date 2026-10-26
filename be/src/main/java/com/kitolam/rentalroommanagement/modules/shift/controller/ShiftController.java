package com.kitolam.rentalroommanagement.modules.shift.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftCreateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftFilterRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.service.ShiftService;
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
@RequestMapping("/api/v1/shifts")
@RequiredArgsConstructor
@Tag(name = "Shifts")
public class ShiftController {

    private final ShiftService shiftService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo ca xem phòng")
    public StandardResponse<ShiftResponse> create(@Valid @RequestBody ShiftCreateRequest request) {
        return StandardResponse.success("Tạo ca xem phòng thành công", shiftService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy ca xem phòng theo id")
    public StandardResponse<ShiftResponse> getById(@PathVariable String id) {
        return StandardResponse.success(shiftService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang ca xem phòng")
    public StandardResponse<PagedResponse<ShiftResponse>> search(
            @Valid @ParameterObject ShiftFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(shiftService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật ca xem phòng")
    public StandardResponse<ShiftResponse> update(@PathVariable String id, @Valid @RequestBody ShiftUpdateRequest request) {
        return StandardResponse.success("Cập nhật ca xem phòng thành công", shiftService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm ca xem phòng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        shiftService.delete(id);
        return StandardResponse.success("Xoá ca xem phòng thành công", null);
    }
}
