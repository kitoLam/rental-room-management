package com.kitolam.rentalroommanagement.modules.servicerequest.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceDateConfirmationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRegistrationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestActionRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceTerminationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceTenancyResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.TenantServiceOverviewResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.ServiceRequestService;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/service-requests")
@RequiredArgsConstructor
@Tag(name = "Service Requests", description = "Đăng ký và ngừng dịch vụ")
public class ServiceRequestController {

    private static final String TENANT = "hasRole('TENANT')";
    private static final String MANAGEMENT = "hasAnyRole('MANAGER', 'OWNER', 'ADMIN')";

    private final ServiceRequestService serviceRequestService;

    // ===== Tenant =====

    @GetMapping("/tenancy")
    @PreAuthorize(TENANT)
    @Operation(summary = "Phòng / chỗ ở mà yêu cầu dịch vụ của người thuê áp dụng")
    public StandardResponse<ServiceTenancyResponse> tenancy(@AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(serviceRequestService.currentTenancy(principal));
    }

    @GetMapping("/catalog")
    @PreAuthorize(TENANT)
    @Operation(summary = "Dịch vụ có thể dùng, kèm dịch vụ đang dùng, yêu cầu đang mở và thao tác được phép")
    public StandardResponse<List<TenantServiceOverviewResponse>> catalog(@AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(serviceRequestService.catalog(principal));
    }

    @PostMapping("/registrations")
    @PreAuthorize(TENANT)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Gửi yêu cầu đăng ký dịch vụ; ngày đề nghị chỉ là đề xuất")
    public StandardResponse<ServiceRequestResponse> register(@Valid @RequestBody ServiceRegistrationRequest request,
                                                             @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gửi yêu cầu đăng ký dịch vụ", serviceRequestService.register(request, principal));
    }

    @PostMapping("/terminations")
    @PreAuthorize(TENANT)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Gửi yêu cầu ngừng một dịch vụ đang sử dụng")
    public StandardResponse<ServiceRequestResponse> terminate(@Valid @RequestBody ServiceTerminationRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gửi yêu cầu ngừng dịch vụ", serviceRequestService.terminate(request, principal));
    }

    @GetMapping("/mine")
    @PreAuthorize(TENANT)
    @Operation(summary = "Yêu cầu dịch vụ của tôi")
    public StandardResponse<PagedResponse<ServiceRequestResponse>> mine(
            @Valid @ParameterObject ServiceRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(serviceRequestService.mine(filter, pageable, principal));
    }

    @PostMapping("/{id}/cancellation")
    @PreAuthorize(TENANT)
    @Operation(summary = "Người thuê hủy yêu cầu đang chờ duyệt")
    public StandardResponse<ServiceRequestResponse> cancel(@PathVariable @ValidObjectId String id,
                                                           @Valid @RequestBody(required = false) ServiceRequestActionRequest request,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã hủy yêu cầu dịch vụ", serviceRequestService.cancel(id, request, principal));
    }

    // ===== Tenant (own request) or management =====

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết và lịch sử xử lý yêu cầu dịch vụ")
    public StandardResponse<ServiceRequestResponse> getById(@PathVariable @ValidObjectId String id,
                                                            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(serviceRequestService.getById(id, principal));
    }

    // ===== Management =====

    @GetMapping
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Danh sách yêu cầu dịch vụ của các chi nhánh được quản lý")
    public StandardResponse<PagedResponse<ServiceRequestResponse>> search(
            @Valid @ParameterObject ServiceRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(serviceRequestService.search(filter, pageable, principal));
    }

    @PostMapping("/{id}/approval")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Duyệt yêu cầu đăng ký; sau đó cần xác nhận ngày lắp đặt")
    public StandardResponse<ServiceRequestResponse> approve(@PathVariable @ValidObjectId String id,
                                                            @Valid @RequestBody(required = false) ServiceRequestActionRequest request,
                                                            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã duyệt yêu cầu", serviceRequestService.approve(id, request, principal));
    }

    @PostMapping("/{id}/rejection")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Từ chối yêu cầu đăng ký hoặc ngừng, bắt buộc lý do")
    public StandardResponse<ServiceRequestResponse> reject(@PathVariable @ValidObjectId String id,
                                                           @Valid @RequestBody ServiceRequestActionRequest request,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã từ chối yêu cầu", serviceRequestService.reject(id, request, principal));
    }

    @PostMapping("/{id}/installation-confirmation")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Xác nhận ngày lắp đặt; dịch vụ bắt đầu tính phí từ ngày này")
    public StandardResponse<ServiceRequestResponse> confirmInstallation(@PathVariable @ValidObjectId String id,
                                                                        @Valid @RequestBody ServiceDateConfirmationRequest request,
                                                                        @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã xác nhận lắp đặt dịch vụ",
                serviceRequestService.confirmInstallation(id, request, principal));
    }

    @PostMapping("/{id}/termination-confirmation")
    @PreAuthorize(MANAGEMENT)
    @Operation(summary = "Duyệt yêu cầu ngừng và xác nhận ngày kết thúc; dịch vụ chuyển STOPPED")
    public StandardResponse<ServiceRequestResponse> confirmTermination(@PathVariable @ValidObjectId String id,
                                                                       @Valid @RequestBody ServiceDateConfirmationRequest request,
                                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã xác nhận ngừng dịch vụ",
                serviceRequestService.confirmTermination(id, request, principal));
    }
}
