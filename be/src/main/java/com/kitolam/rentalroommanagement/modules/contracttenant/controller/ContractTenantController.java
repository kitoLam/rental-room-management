package com.kitolam.rentalroommanagement.modules.contracttenant.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.ContractTenantResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
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
@RequestMapping("/api/v1/contract-tenants")
@RequiredArgsConstructor
@Tag(name = "Contract Tenants")
public class ContractTenantController {

    private final ContractTenantService contractTenantService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo người thuê trong hợp đồng")
    public StandardResponse<ContractTenantResponse> create(@Valid @RequestBody ContractTenantCreateRequest request) {
        return StandardResponse.success("Tạo người thuê trong hợp đồng thành công", contractTenantService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy người thuê trong hợp đồng theo id")
    public StandardResponse<ContractTenantResponse> getById(@PathVariable String id) {
        return StandardResponse.success(contractTenantService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang người thuê trong hợp đồng")
    public StandardResponse<PagedResponse<ContractTenantResponse>> search(
            @Valid @ParameterObject ContractTenantFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(contractTenantService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật người thuê trong hợp đồng")
    public StandardResponse<ContractTenantResponse> update(@PathVariable String id, @Valid @RequestBody ContractTenantUpdateRequest request) {
        return StandardResponse.success("Cập nhật người thuê trong hợp đồng thành công", contractTenantService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm người thuê trong hợp đồng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        contractTenantService.delete(id);
        return StandardResponse.success("Xoá người thuê trong hợp đồng thành công", null);
    }
}
