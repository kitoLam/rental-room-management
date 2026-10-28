package com.kitolam.rentalroommanagement.modules.shift.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftBulkUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.BranchShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/shifts")
@RequiredArgsConstructor
@Tag(name = "Shifts")
public class ShiftController {
    // Appointment flow owns permissions and the snapshots of booked appointments.
    private final AppointmentService appointmentService;

    @GetMapping("/rooms/{roomId}")
    @Operation(summary = "Owner/Manager xem cấu hình ba ca và lịch hiện hữu")
    public StandardResponse<ShiftResponse> configuration(@PathVariable @ValidObjectId String roomId) {
        return StandardResponse.success(appointmentService.shiftConfiguration(roomId));
    }

    @PutMapping("/rooms/{roomId}")
    @Operation(summary = "Owner/Manager cập nhật ba ca, giữ nguyên lịch đã đặt")
    public StandardResponse<ShiftResponse> update(@PathVariable @ValidObjectId String roomId,
                                                 @Valid @RequestBody ShiftUpdateRequest request) {
        return StandardResponse.success("Đã lưu cấu hình ca", appointmentService.updateShiftConfiguration(roomId, request));
    }

    @GetMapping("/rooms/{roomId}/availability")
    @Operation(summary = "Guest hoặc người tìm thuê tra cứu ca khả dụng theo ngày Việt Nam")
    public StandardResponse<ViewingAvailabilityResponse> availability(
            @PathVariable @ValidObjectId String roomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return StandardResponse.success(appointmentService.viewingAvailability(roomId, date));
    }

    @GetMapping("/branches/{branchId}")
    @Operation(summary = "Owner/Manager xem cấu hình phòng trong chi nhánh, phân trang từ 1")
    public StandardResponse<PagedResponse<BranchShiftResponse>> branchConfigurations(
            @PathVariable @ValidObjectId String branchId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return StandardResponse.success(appointmentService.branchShiftConfigurations(branchId, page, size));
    }

    @PatchMapping("/branches/{branchId}")
    @Operation(summary = "Cập nhật giờ một ca cho tối đa 100 phòng; trả kết quả độc lập từng phòng")
    public StandardResponse<ShiftBulkUpdateResponse> updateBranch(
            @PathVariable @ValidObjectId String branchId, @Valid @RequestBody ShiftBulkUpdateRequest request) {
        return StandardResponse.success("Đã xử lý yêu cầu cập nhật ca", appointmentService.updateBranchShifts(branchId, request));
    }
}
