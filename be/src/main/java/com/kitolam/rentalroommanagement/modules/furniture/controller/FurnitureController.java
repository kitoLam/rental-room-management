package com.kitolam.rentalroommanagement.modules.furniture.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureResponse;
import com.kitolam.rentalroommanagement.modules.furniture.service.FurnitureService;
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
@RequestMapping("/api/v1/furnitures")
@RequiredArgsConstructor
@Tag(name = "Furnitures")
public class FurnitureController {

    private final FurnitureService furnitureService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo nội thất")
    public StandardResponse<FurnitureResponse> create(@Valid @RequestBody FurnitureCreateRequest request) {
        return StandardResponse.success("Tạo nội thất thành công", furnitureService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy nội thất theo id")
    public StandardResponse<FurnitureResponse> getById(@PathVariable String id) {
        return StandardResponse.success(furnitureService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang nội thất")
    public StandardResponse<PagedResponse<FurnitureResponse>> search(
            @Valid @ParameterObject FurnitureFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(furnitureService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật nội thất")
    public StandardResponse<FurnitureResponse> update(@PathVariable String id, @Valid @RequestBody FurnitureUpdateRequest request) {
        return StandardResponse.success("Cập nhật nội thất thành công", furnitureService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm nội thất")
    public StandardResponse<Void> delete(@PathVariable String id) {
        furnitureService.delete(id);
        return StandardResponse.success("Xoá nội thất thành công", null);
    }
}
