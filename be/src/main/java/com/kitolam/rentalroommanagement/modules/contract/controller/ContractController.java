package com.kitolam.rentalroommanagement.modules.contract.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
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
@RequestMapping("/api/v1/contracts")
@RequiredArgsConstructor
@Tag(name = "Contracts")
public class ContractController {

    private final ContractService contractService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo hợp đồng")
    public StandardResponse<ContractResponse> create(@Valid @RequestBody ContractCreateRequest request) {
        return StandardResponse.success("Tạo hợp đồng thành công", contractService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy hợp đồng theo id")
    public StandardResponse<ContractResponse> getById(@PathVariable String id) {
        return StandardResponse.success(contractService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang hợp đồng")
    public StandardResponse<PagedResponse<ContractResponse>> search(
            @Valid @ParameterObject ContractFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(contractService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật hợp đồng")
    public StandardResponse<ContractResponse> update(@PathVariable String id, @Valid @RequestBody ContractUpdateRequest request) {
        return StandardResponse.success("Cập nhật hợp đồng thành công", contractService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm hợp đồng")
    public StandardResponse<Void> delete(@PathVariable String id) {
        contractService.delete(id);
        return StandardResponse.success("Xoá hợp đồng thành công", null);
    }
}
