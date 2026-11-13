package com.kitolam.rentalroommanagement.modules.meterreading.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.request.MeterReadingSaveRequest;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterBoardResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterReadingResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.TenantMeterYearResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.service.MeterReadingService;
import com.kitolam.rentalroommanagement.modules.meterreading.service.impl.TenantMeterReadingService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/meter-readings")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
@Tag(name = "Meter Readings")
public class MeterReadingController {

    private final MeterReadingService service;
    private final TenantMeterReadingService tenantService;

    @GetMapping("/my")
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Người thuê: chỉ số điện 12 tháng trong năm của phòng thuộc hợp đồng")
    public StandardResponse<TenantMeterYearResponse> my(
            @RequestParam @ValidObjectId String contractId,
            @RequestParam @Min(2000) @Max(2100) int year,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(tenantService.year(contractId, year, principal));
    }

    @GetMapping("/board")
    @Operation(summary = "Bảng chỉ số điện của chi nhánh trong một tháng (kèm giá điện)")
    public StandardResponse<MeterBoardResponse> board(
            @RequestParam @ValidObjectId String branchId,
            @RequestParam @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.board(branchId, period, principal));
    }

    @PutMapping
    @Operation(summary = "Nhập / sửa chỉ số điện (bản nháp) của một phòng trong tháng")
    public StandardResponse<MeterReadingResponse> save(@Valid @RequestBody MeterReadingSaveRequest request,
                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã lưu chỉ số", service.save(request, principal));
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Chốt chỉ số")
    public StandardResponse<MeterReadingResponse> confirm(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã chốt chỉ số", service.confirm(id, principal));
    }

    @PostMapping("/{id}/reopen")
    @Operation(summary = "Mở lại chỉ số đã chốt để sửa")
    public StandardResponse<MeterReadingResponse> reopen(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã mở lại chỉ số", service.reopen(id, principal));
    }
}
