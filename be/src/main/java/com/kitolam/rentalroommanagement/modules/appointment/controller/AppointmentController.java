package com.kitolam.rentalroommanagement.modules.appointment.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentActionRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingContextResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingEligibilityResponse;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;

@RestController
@RequestMapping("/api/v1/appointments")
@RequiredArgsConstructor
@Tag(name = "Appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    @GetMapping("/notifications")
    @Operation(summary = "Thông báo lịch xem của tài khoản, xét phạm vi quyền hiện tại")
    public StandardResponse<PagedResponse<NotificationResponse>> notifications(
            @RequestParam(required = false) Boolean read, @ParameterObject Pageable pageable) {
        return StandardResponse.success(appointmentService.notifications(read, pageable));
    }

    @PostMapping("/notifications/{notificationId}/read")
    @Operation(summary = "Đánh dấu thông báo đã đọc, giữ thời điểm đọc đầu tiên")
    public StandardResponse<NotificationResponse> readNotification(@PathVariable String notificationId) {
        return StandardResponse.success(appointmentService.readNotification(notificationId));
    }

    @PostMapping("/notifications/read-all")
    public StandardResponse<Long> readAllNotifications() {
        return StandardResponse.success(appointmentService.readAllNotifications());
    }

    @GetMapping("/context")
    @Operation(summary = "Tài khoản và phạm vi quyền lịch xem hiện tại")
    public StandardResponse<ViewingContextResponse> currentContext() {
        return StandardResponse.success(appointmentService.currentContext());
    }

    @GetMapping("/rooms/{roomId}/eligibility")
    @Operation(summary = "Điều kiện nhận lịch xem của phòng công khai; Guest được truy cập, chưa bao gồm ca trống")
    public StandardResponse<ViewingEligibilityResponse> roomEligibility(
            @PathVariable @ValidObjectId String roomId) {
        return StandardResponse.success(appointmentService.publicRoomEligibility(roomId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo lịch hẹn")
    public StandardResponse<AppointmentResponse> create(@Valid @RequestBody AppointmentCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return StandardResponse.success("Tạo lịch hẹn thành công", appointmentService.create(request, idempotencyKey));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy lịch hẹn theo id")
    public StandardResponse<AppointmentResponse> getById(@PathVariable @ValidObjectId String id) {
        return StandardResponse.success(appointmentService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang lịch hẹn")
    public StandardResponse<PagedResponse<AppointmentResponse>> search(
            @Valid @ParameterObject AppointmentFilterRequest filter,
            @ParameterObject @PageableDefault(sort = {"appointmentDate", "startAt"}, direction = Sort.Direction.ASC) Pageable pageable) {
        return StandardResponse.success(appointmentService.search(filter, pageable));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Lịch sử nghiệp vụ của lịch hẹn trong phạm vi được phép")
    public StandardResponse<java.util.List<AppointmentResponse.HistoryItem>> history(@PathVariable @ValidObjectId String id) {
        return StandardResponse.success(appointmentService.getById(id).history());
    }

    @PostMapping("/{id}/approval")
    @Operation(summary = "Duyệt yêu cầu xem phòng còn hạn")
    public StandardResponse<AppointmentResponse> approve(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.Approval request) {
        return StandardResponse.success(appointmentService.approve(id, request));
    }

    @PostMapping("/{id}/rejection")
    @Operation(summary = "Từ chối yêu cầu, bắt buộc lý do")
    public StandardResponse<AppointmentResponse> reject(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.Rejection request) {
        return StandardResponse.success(appointmentService.reject(id, request));
    }

    @PostMapping("/{id}/cancellation")
    @Operation(summary = "Hủy theo quyền và điều kiện thời gian của người thao tác")
    public StandardResponse<AppointmentResponse> cancel(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.Cancellation request) {
        return StandardResponse.success(appointmentService.cancel(id, request));
    }

    @PostMapping("/{id}/completion")
    @Operation(summary = "Ghi nhận buổi xem đã thực tế kết thúc")
    public StandardResponse<AppointmentResponse> complete(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.Completion request) {
        return StandardResponse.success(appointmentService.complete(id, request));
    }

    @PostMapping("/{id}/no-show")
    @Operation(summary = "Ghi nhận không đến từ cuối ca, phía cho thuê vẫn tiếp khách được")
    public StandardResponse<AppointmentResponse> noShow(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.NoShow request) {
        return StandardResponse.success(appointmentService.noShow(id, request));
    }

    @PostMapping("/{id}/result-corrections")
    @Operation(summary = "Sửa kết quả hoặc ghi chú, bắt buộc lý do sửa và giữ lịch sử")
    public StandardResponse<AppointmentResponse> correctResult(@PathVariable @ValidObjectId String id,
            @Valid @RequestBody AppointmentActionRequest.Correction request) {
        return StandardResponse.success(appointmentService.correctResult(id, request));
    }
}
