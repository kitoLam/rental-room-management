package com.kitolam.rentalroommanagement.modules.slotservicerequest.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestDecisionRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.response.SlotServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.service.SlotServiceRequestService;
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

@RestController
@RequestMapping("/api/v1/slot-service-requests")
@RequiredArgsConstructor
@Tag(name = "Slot Service Requests")
public class SlotServiceRequestController {

    private static final String STAFF = "hasAnyRole('OWNER', 'MANAGER', 'ADMIN')";

    private final SlotServiceRequestService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Người thuê xin đăng ký (ADD) hoặc huỷ (CANCEL) một dịch vụ tự chọn")
    public StandardResponse<SlotServiceRequestResponse> create(@Valid @RequestBody SlotServiceRequestCreateRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gửi yêu cầu", service.create(request, principal));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Yêu cầu dịch vụ của người thuê đang đăng nhập")
    public StandardResponse<PagedResponse<SlotServiceRequestResponse>> mine(
            @Valid @ParameterObject SlotServiceRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.mine(filter, pageable, principal));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('TENANT')")
    @Operation(summary = "Người thuê rút lại yêu cầu đang chờ")
    public StandardResponse<SlotServiceRequestResponse> cancel(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã rút yêu cầu", service.cancel(id, principal));
    }

    @GetMapping
    @PreAuthorize(STAFF)
    @Operation(summary = "Yêu cầu dịch vụ của các chi nhánh bạn quản lý")
    public StandardResponse<PagedResponse<SlotServiceRequestResponse>> search(
            @Valid @ParameterObject SlotServiceRequestFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(service.search(filter, pageable, principal));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(STAFF)
    @Operation(summary = "Duyệt yêu cầu (cập nhật dịch vụ đang dùng của hợp đồng)")
    public StandardResponse<SlotServiceRequestResponse> approve(@PathVariable String id,
                                                               @Valid @RequestBody(required = false) SlotServiceRequestDecisionRequest request,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã duyệt yêu cầu", service.approve(id, request, principal));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(STAFF)
    @Operation(summary = "Từ chối yêu cầu")
    public StandardResponse<SlotServiceRequestResponse> reject(@PathVariable String id,
                                                              @Valid @RequestBody SlotServiceRequestDecisionRequest request,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã từ chối yêu cầu", service.reject(id, request, principal));
    }
}
