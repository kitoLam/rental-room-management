package com.kitolam.rentalroommanagement.modules.furniture.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureGroupUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureGroupResponse;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Only OWNER / MANAGER of the branch (and ADMIN) can use these; tenants only see amenities on the room. */
@RestController
@RequestMapping("/api/v1/furnitures")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
@Tag(name = "Furnitures")
public class FurnitureController {

    private final FurnitureService furnitureService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo cơ sở vật chất cho nhiều phòng (mỗi phòng một bản ghi)")
    public StandardResponse<FurnitureGroupResponse> create(@Valid @RequestBody FurnitureCreateRequest request,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Tạo cơ sở vật chất thành công", furnitureService.create(request, principal));
    }

    @GetMapping("/groups")
    @Operation(summary = "Cơ sở vật chất của chi nhánh, nhóm theo tên")
    public StandardResponse<List<FurnitureGroupResponse>> groups(@RequestParam String branchId,
                                                                 @RequestParam(required = false) String keyword,
                                                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(furnitureService.groups(branchId, keyword, principal));
    }

    @PatchMapping("/groups")
    @Operation(summary = "Cập nhật cơ sở vật chất theo tên (đổi tên, số lượng, tình trạng, danh sách phòng)")
    public StandardResponse<FurnitureGroupResponse> updateGroup(@Valid @RequestBody FurnitureGroupUpdateRequest request,
                                                                @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật cơ sở vật chất thành công", furnitureService.updateGroup(request, principal));
    }

    @DeleteMapping("/groups")
    @Operation(summary = "Xoá cơ sở vật chất theo tên (gỡ khỏi mọi phòng của chi nhánh)")
    public StandardResponse<Void> deleteGroup(@RequestParam String branchId, @RequestParam String name,
                                              @AuthenticationPrincipal AuthPrincipal principal) {
        furnitureService.deleteGroup(branchId, name, principal);
        return StandardResponse.success("Xoá cơ sở vật chất thành công", null);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy bản ghi cơ sở vật chất của một phòng theo id")
    public StandardResponse<FurnitureResponse> getById(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(furnitureService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang bản ghi cơ sở vật chất theo phòng")
    public StandardResponse<PagedResponse<FurnitureResponse>> search(
            @Valid @ParameterObject FurnitureFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(furnitureService.search(filter, pageable, principal));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật bản ghi cơ sở vật chất của một phòng")
    public StandardResponse<FurnitureResponse> update(@PathVariable String id, @Valid @RequestBody FurnitureUpdateRequest request,
                                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật cơ sở vật chất thành công", furnitureService.update(id, request, principal));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm bản ghi cơ sở vật chất của một phòng")
    public StandardResponse<Void> delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        furnitureService.delete(id, principal);
        return StandardResponse.success("Xoá cơ sở vật chất thành công", null);
    }
}
