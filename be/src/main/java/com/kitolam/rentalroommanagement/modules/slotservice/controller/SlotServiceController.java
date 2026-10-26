package com.kitolam.rentalroommanagement.modules.slotservice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceService;
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
@RequestMapping("/api/v1/slot-services")
@RequiredArgsConstructor
@Tag(name = "Slot Services")
public class SlotServiceController {

    private final SlotServiceService slotServiceService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo dịch vụ theo chỗ")
    public StandardResponse<SlotServiceResponse> create(@Valid @RequestBody SlotServiceCreateRequest request) {
        return StandardResponse.success("Tạo dịch vụ theo chỗ thành công", slotServiceService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy dịch vụ theo chỗ theo id")
    public StandardResponse<SlotServiceResponse> getById(@PathVariable String id) {
        return StandardResponse.success(slotServiceService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang dịch vụ theo chỗ")
    public StandardResponse<PagedResponse<SlotServiceResponse>> search(
            @Valid @ParameterObject SlotServiceFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(slotServiceService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật dịch vụ theo chỗ")
    public StandardResponse<SlotServiceResponse> update(@PathVariable String id, @Valid @RequestBody SlotServiceUpdateRequest request) {
        return StandardResponse.success("Cập nhật dịch vụ theo chỗ thành công", slotServiceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm dịch vụ theo chỗ")
    public StandardResponse<Void> delete(@PathVariable String id) {
        slotServiceService.delete(id);
        return StandardResponse.success("Xoá dịch vụ theo chỗ thành công", null);
    }
}
