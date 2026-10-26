package com.kitolam.rentalroommanagement.modules.booking.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
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
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Tag(name = "Bookings")
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo đặt phòng")
    public StandardResponse<BookingResponse> create(@Valid @RequestBody BookingCreateRequest request) {
        return StandardResponse.success("Tạo đặt phòng thành công", bookingService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy đặt phòng theo id")
    public StandardResponse<BookingResponse> getById(@PathVariable String id) {
        return StandardResponse.success(bookingService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang đặt phòng")
    public StandardResponse<PagedResponse<BookingResponse>> search(
            @Valid @ParameterObject BookingFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(bookingService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật đặt phòng")
    public StandardResponse<BookingResponse> update(@PathVariable String id, @Valid @RequestBody BookingUpdateRequest request) {
        return StandardResponse.success("Cập nhật đặt phòng thành công", bookingService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm đặt phòng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        bookingService.delete(id);
        return StandardResponse.success("Xoá đặt phòng thành công", null);
    }
}
