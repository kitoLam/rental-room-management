package com.kitolam.rentalroommanagement.modules.reportrequest.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestAdminResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestEscalateAdminRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestInfoRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestProgressRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestRejectRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestReopenRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestSupplementRequest;
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

@RestController
@RequestMapping("/api/v1/report-requests")
@RequiredArgsConstructor
@Tag(name = "Report Requests", description = "Quản lý luồng yêu cầu hỗ trợ (sửa chữa, khiếu nại, gia hạn)")
public class ReportRequestController {

    private final ReportRequestService reportRequestService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tenant hoặc Owner gửi yêu cầu hỗ trợ (hệ thống kiểm tra hợp đồng hiệu lực và tự gán Manager)")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER')")
    public StandardResponse<ReportRequestResponse> create(
            @Valid @RequestBody ReportRequestCreateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Gửi yêu cầu hỗ trợ thành công", reportRequestService.create(request, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết yêu cầu hỗ trợ kèm tiến trình lịch sử")
    @PreAuthorize("hasAnyRole('TENANT', 'MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> getById(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(reportRequestService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang danh sách yêu cầu hỗ trợ")
    @PreAuthorize("hasAnyRole('TENANT', 'MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<PagedResponse<ReportRequestResponse>> search(
            @Valid @ParameterObject ReportRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(reportRequestService.search(filter, pageable, principal));
    }

    @PostMapping("/{id}/start")
    @Operation(summary = "Manager bắt đầu xử lý yêu cầu (chuyển PENDING sang IN_PROGRESS)")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> start(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Bắt đầu xử lý yêu cầu", reportRequestService.startProcessing(id, principal));
    }

    @PostMapping("/{id}/request-info")
    @Operation(summary = "Manager yêu cầu bổ sung thông tin (chuyển sang Chờ bổ sung)")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> requestInfo(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestInfoRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gửi yêu cầu bổ sung thông tin", reportRequestService.requestInfo(id, request, principal));
    }

    @PostMapping("/{id}/supplement")
    @Operation(summary = "Tenant bổ sung thông tin (quay lại tiếp nhận PENDING)")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN')")
    public StandardResponse<ReportRequestResponse> supplementInfo(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestSupplementRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Bổ sung thông tin thành công", reportRequestService.supplementInfo(id, request, principal));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Manager từ chối yêu cầu kèm lý do")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> reject(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestRejectRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã từ chối yêu cầu", reportRequestService.reject(id, request, principal));
    }

    @PostMapping("/{id}/progress")
    @Operation(summary = "Manager cập nhật tiến độ xử lý (giữ IN_PROGRESS)")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> updateProgress(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestProgressRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật tiến độ thành công", reportRequestService.updateProgress(id, request, principal));
    }

    @PostMapping("/{id}/resolve")
    @Operation(summary = "Manager ghi nhận kết quả đã giải quyết")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> resolve(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestResolveRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã ghi nhận giải quyết yêu cầu", reportRequestService.resolve(id, request, principal));
    }

    @PostMapping("/{id}/confirm-close")
    @Operation(summary = "Tenant xác nhận hài lòng và đóng yêu cầu")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN')")
    public StandardResponse<ReportRequestResponse> confirmClose(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã xác nhận và đóng yêu cầu", reportRequestService.confirmClose(id, principal));
    }

    @PostMapping("/{id}/reopen")
    @Operation(summary = "Tenant không hài lòng, mở lại yêu cầu để tiếp tục xử lý")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN')")
    public StandardResponse<ReportRequestResponse> reopen(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestReopenRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã mở lại yêu cầu", reportRequestService.reopen(id, request, principal));
    }

    @PostMapping("/{id}/escalate-admin")
    @Operation(summary = "Tenant chuyển tranh chấp lên Admin phân xử")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN')")
    public StandardResponse<ReportRequestResponse> escalateAdmin(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestEscalateAdminRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã chuyển tranh chấp lên Admin", reportRequestService.escalateAdmin(id, request, principal));
    }

    @PostMapping("/{id}/admin-resolve")
    @Operation(summary = "Admin ghi nhận kết quả phân xử tranh chấp và đóng hồ sơ")
    @PreAuthorize("hasRole('ADMIN')")
    public StandardResponse<ReportRequestResponse> adminResolve(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestAdminResolveRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Admin đã kết luận và đóng hồ sơ", reportRequestService.adminResolve(id, request, principal));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Tenant tự hủy yêu cầu khi chưa được xử lý")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN')")
    public StandardResponse<ReportRequestResponse> cancel(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã hủy yêu cầu", reportRequestService.cancel(id, principal));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin yêu cầu báo cáo (PATCH)")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<ReportRequestResponse> update(
            @PathVariable String id,
            @Valid @RequestBody ReportRequestUpdateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Cập nhật yêu cầu thành công", reportRequestService.update(id, request, principal));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm yêu cầu báo cáo")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<Void> delete(
            @PathVariable String id,
            @AuthenticationPrincipal AuthPrincipal principal) {
        reportRequestService.delete(id, principal);
        return StandardResponse.success("Xoá yêu cầu báo cáo thành công", null);
    }
}
