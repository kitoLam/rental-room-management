package com.kitolam.rentalroommanagement.modules.reportrequest.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
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
@RequestMapping("/api/v1/report-requests")
@RequiredArgsConstructor
@Tag(name = "Report Requests")
public class ReportRequestController {

    private final ReportRequestService reportRequestService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo yêu cầu báo cáo")
    public StandardResponse<ReportRequestResponse> create(@Valid @RequestBody ReportRequestCreateRequest request) {
        return StandardResponse.success("Tạo yêu cầu báo cáo thành công", reportRequestService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy yêu cầu báo cáo theo id")
    public StandardResponse<ReportRequestResponse> getById(@PathVariable String id) {
        return StandardResponse.success(reportRequestService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang yêu cầu báo cáo")
    public StandardResponse<PagedResponse<ReportRequestResponse>> search(
            @Valid @ParameterObject ReportRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(reportRequestService.search(filter, pageable));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật yêu cầu báo cáo")
    public StandardResponse<ReportRequestResponse> update(@PathVariable String id, @Valid @RequestBody ReportRequestUpdateRequest request) {
        return StandardResponse.success("Cập nhật yêu cầu báo cáo thành công", reportRequestService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm yêu cầu báo cáo")
    public StandardResponse<Void> delete(@PathVariable String id) {
        reportRequestService.delete(id);
        return StandardResponse.success("Xoá yêu cầu báo cáo thành công", null);
    }
}
