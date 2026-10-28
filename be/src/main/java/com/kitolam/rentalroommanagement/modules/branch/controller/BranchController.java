package com.kitolam.rentalroommanagement.modules.branch.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchCreateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchFilterRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchUpdateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;

@RestController
@RequestMapping("/api/v1/branches")
@RequiredArgsConstructor
@Tag(name = "Branches")
public class BranchController {

    private final BranchService branchService;

    @GetMapping("/{id}/utility-rates")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public StandardResponse<UtilityRatesResponse> utilityRates(@PathVariable @ValidObjectId String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(branchService.utilityRates(id, principal));
    }

    @PutMapping("/{id}/utility-rates")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public StandardResponse<UtilityRatesResponse> updateUtilityRates(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody UtilityRatesRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(branchService.updateUtilityRates(id, request, principal));
    }

    @GetMapping("/managed")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ADMIN')")
    public StandardResponse<List<BranchResponse>> managed(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(branchService.managedBranches(principal));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo chi nhánh")
    public StandardResponse<BranchResponse> create(@Valid @RequestBody BranchCreateRequest request) {
        return StandardResponse.success("Tạo chi nhánh thành công", branchService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi nhánh theo id")
    public StandardResponse<BranchResponse> getById(@PathVariable String id) {
        return StandardResponse.success(branchService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang chi nhánh")
    public StandardResponse<PagedResponse<BranchResponse>> search(
            @Valid @ParameterObject BranchFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(branchService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật chi nhánh")
    public StandardResponse<BranchResponse> update(@PathVariable String id, @Valid @RequestBody BranchUpdateRequest request) {
        return StandardResponse.success("Cập nhật chi nhánh thành công", branchService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm chi nhánh")
    public StandardResponse<Void> delete(@PathVariable String id) {
        branchService.delete(id);
        return StandardResponse.success("Xoá chi nhánh thành công", null);
    }
}
