package com.kitolam.rentalroommanagement.modules.reportrequestservice.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response.ReportRequestServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.service.ReportRequestServiceItemService;
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
@RequestMapping("/api/v1/report-request-services")
@RequiredArgsConstructor
@Tag(name = "Report Request Services")
public class ReportRequestServiceItemController {

    private final ReportRequestServiceItemService reportRequestServiceItemService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo dịch vụ trong báo cáo")
    public StandardResponse<ReportRequestServiceItemResponse> create(@Valid @RequestBody ReportRequestServiceItemCreateRequest request) {
        return StandardResponse.success("Tạo dịch vụ trong báo cáo thành công", reportRequestServiceItemService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy dịch vụ trong báo cáo theo id")
    public StandardResponse<ReportRequestServiceItemResponse> getById(@PathVariable String id) {
        return StandardResponse.success(reportRequestServiceItemService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang dịch vụ trong báo cáo")
    public StandardResponse<PagedResponse<ReportRequestServiceItemResponse>> search(
            @Valid @ParameterObject ReportRequestServiceItemFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(reportRequestServiceItemService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật dịch vụ trong báo cáo")
    public StandardResponse<ReportRequestServiceItemResponse> update(@PathVariable String id, @Valid @RequestBody ReportRequestServiceItemUpdateRequest request) {
        return StandardResponse.success("Cập nhật dịch vụ trong báo cáo thành công", reportRequestServiceItemService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm dịch vụ trong báo cáo")
    public StandardResponse<Void> delete(@PathVariable String id) {
        reportRequestServiceItemService.delete(id);
        return StandardResponse.success("Xoá dịch vụ trong báo cáo thành công", null);
    }
}
