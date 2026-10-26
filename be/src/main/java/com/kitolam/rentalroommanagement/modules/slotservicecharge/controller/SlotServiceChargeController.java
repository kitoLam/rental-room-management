package com.kitolam.rentalroommanagement.modules.slotservicecharge.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.response.SlotServiceChargeResponse;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.service.SlotServiceChargeService;
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
@RequestMapping("/api/v1/slot-service-charges")
@RequiredArgsConstructor
@Tag(name = "Slot Service Charges")
public class SlotServiceChargeController {

    private final SlotServiceChargeService slotServiceChargeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo phí dịch vụ theo chỗ")
    public StandardResponse<SlotServiceChargeResponse> create(@Valid @RequestBody SlotServiceChargeCreateRequest request) {
        return StandardResponse.success("Tạo phí dịch vụ theo chỗ thành công", slotServiceChargeService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy phí dịch vụ theo chỗ theo id")
    public StandardResponse<SlotServiceChargeResponse> getById(@PathVariable String id) {
        return StandardResponse.success(slotServiceChargeService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang phí dịch vụ theo chỗ")
    public StandardResponse<PagedResponse<SlotServiceChargeResponse>> search(
            @Valid @ParameterObject SlotServiceChargeFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(slotServiceChargeService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật phí dịch vụ theo chỗ")
    public StandardResponse<SlotServiceChargeResponse> update(@PathVariable String id, @Valid @RequestBody SlotServiceChargeUpdateRequest request) {
        return StandardResponse.success("Cập nhật phí dịch vụ theo chỗ thành công", slotServiceChargeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm phí dịch vụ theo chỗ")
    public StandardResponse<Void> delete(@PathVariable String id) {
        slotServiceChargeService.delete(id);
        return StandardResponse.success("Xoá phí dịch vụ theo chỗ thành công", null);
    }
}
