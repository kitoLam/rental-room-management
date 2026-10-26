package com.kitolam.rentalroommanagement.modules.appointment.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
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
@RequestMapping("/api/v1/appointments")
@RequiredArgsConstructor
@Tag(name = "Appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo lịch hẹn")
    public StandardResponse<AppointmentResponse> create(@Valid @RequestBody AppointmentCreateRequest request) {
        return StandardResponse.success("Tạo lịch hẹn thành công", appointmentService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy lịch hẹn theo id")
    public StandardResponse<AppointmentResponse> getById(@PathVariable String id) {
        return StandardResponse.success(appointmentService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang lịch hẹn")
    public StandardResponse<PagedResponse<AppointmentResponse>> search(
            @Valid @ParameterObject AppointmentFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(appointmentService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật lịch hẹn")
    public StandardResponse<AppointmentResponse> update(@PathVariable String id, @Valid @RequestBody AppointmentUpdateRequest request) {
        return StandardResponse.success("Cập nhật lịch hẹn thành công", appointmentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm lịch hẹn")
    public StandardResponse<Void> delete(@PathVariable String id) {
        appointmentService.delete(id);
        return StandardResponse.success("Xoá lịch hẹn thành công", null);
    }
}
