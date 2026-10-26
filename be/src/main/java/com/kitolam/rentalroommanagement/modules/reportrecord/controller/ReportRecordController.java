package com.kitolam.rentalroommanagement.modules.reportrecord.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.service.ReportRecordService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/report-records")
@RequiredArgsConstructor
@Tag(name = "Report Records")
public class ReportRecordController {

    private final ReportRecordService reportRecordService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo lịch sử xử lý báo cáo")
    public StandardResponse<ReportRecordResponse> create(@Valid @RequestBody ReportRecordCreateRequest request) {
        return StandardResponse.success("Tạo lịch sử xử lý báo cáo thành công", reportRecordService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy lịch sử xử lý báo cáo theo id")
    public StandardResponse<ReportRecordResponse> getById(@PathVariable String id) {
        return StandardResponse.success(reportRecordService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang lịch sử xử lý báo cáo")
    public StandardResponse<PagedResponse<ReportRecordResponse>> search(
            @Valid @ParameterObject ReportRecordFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return StandardResponse.success(reportRecordService.search(filter, pageable));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm lịch sử xử lý báo cáo")
    public StandardResponse<Void> delete(@PathVariable String id) {
        reportRecordService.delete(id);
        return StandardResponse.success("Xoá lịch sử xử lý báo cáo thành công", null);
    }
}
