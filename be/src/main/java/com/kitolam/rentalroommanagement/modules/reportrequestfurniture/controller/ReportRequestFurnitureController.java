package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response.ReportRequestFurnitureResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service.ReportRequestFurnitureService;
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
@RequestMapping("/api/v1/report-request-furnitures")
@RequiredArgsConstructor
@Tag(name = "Report Request Furnitures")
public class ReportRequestFurnitureController {

    private final ReportRequestFurnitureService reportRequestFurnitureService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo nội thất trong báo cáo")
    public StandardResponse<ReportRequestFurnitureResponse> create(@Valid @RequestBody ReportRequestFurnitureCreateRequest request) {
        return StandardResponse.success("Tạo nội thất trong báo cáo thành công", reportRequestFurnitureService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy nội thất trong báo cáo theo id")
    public StandardResponse<ReportRequestFurnitureResponse> getById(@PathVariable String id) {
        return StandardResponse.success(reportRequestFurnitureService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang nội thất trong báo cáo")
    public StandardResponse<PagedResponse<ReportRequestFurnitureResponse>> search(
            @Valid @ParameterObject ReportRequestFurnitureFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(reportRequestFurnitureService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật nội thất trong báo cáo")
    public StandardResponse<ReportRequestFurnitureResponse> update(@PathVariable String id, @Valid @RequestBody ReportRequestFurnitureUpdateRequest request) {
        return StandardResponse.success("Cập nhật nội thất trong báo cáo thành công", reportRequestFurnitureService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm nội thất trong báo cáo")
    public StandardResponse<Void> delete(@PathVariable String id) {
        reportRequestFurnitureService.delete(id);
        return StandardResponse.success("Xoá nội thất trong báo cáo thành công", null);
    }
}
