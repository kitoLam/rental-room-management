package com.kitolam.rentalroommanagement.modules.manager.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerCreateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerFilterRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerUpdateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
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
@RequestMapping("/api/v1/managers")
@RequiredArgsConstructor
@Tag(name = "Managers")
public class ManagerController {

    private final ManagerService managerService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo quản lý")
    public StandardResponse<ManagerResponse> create(@Valid @RequestBody ManagerCreateRequest request) {
        return StandardResponse.success("Tạo quản lý thành công", managerService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy quản lý theo id")
    public StandardResponse<ManagerResponse> getById(@PathVariable String id) {
        return StandardResponse.success(managerService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang quản lý")
    public StandardResponse<PagedResponse<ManagerResponse>> search(
            @Valid @ParameterObject ManagerFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(managerService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật quản lý")
    public StandardResponse<ManagerResponse> update(@PathVariable String id, @Valid @RequestBody ManagerUpdateRequest request) {
        return StandardResponse.success("Cập nhật quản lý thành công", managerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm quản lý")
    public StandardResponse<Void> delete(@PathVariable String id) {
        managerService.delete(id);
        return StandardResponse.success("Xoá quản lý thành công", null);
    }
}
