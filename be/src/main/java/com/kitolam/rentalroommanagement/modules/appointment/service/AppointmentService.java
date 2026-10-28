package com.kitolam.rentalroommanagement.modules.appointment.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentActionRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingContextResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingEligibilityResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftBulkUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.BranchShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse;

import java.time.LocalDate;

import org.springframework.data.domain.Pageable;


public interface AppointmentService {
    PagedResponse<com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse> notifications(Boolean read, Pageable pageable);

    com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse readNotification(String id);

    long readAllNotifications();

    PagedResponse<BranchShiftResponse> branchShiftConfigurations(String branchId, int page, int size);

    ShiftBulkUpdateResponse updateBranchShifts(String branchId, ShiftBulkUpdateRequest request);

    ShiftResponse shiftConfiguration(String roomId);

    ShiftResponse updateShiftConfiguration(String roomId, ShiftUpdateRequest request);

    ViewingAvailabilityResponse viewingAvailability(String roomId, LocalDate date);

    ViewingContextResponse currentContext();

    ViewingEligibilityResponse publicRoomEligibility(String roomId);

    AppointmentResponse create(AppointmentCreateRequest request, String idempotencyKey);

    AppointmentResponse getById(String id);

    PagedResponse<AppointmentResponse> search(AppointmentFilterRequest filter, Pageable pageable);

    AppointmentResponse approve(String id, AppointmentActionRequest.Approval request);

    AppointmentResponse reject(String id, AppointmentActionRequest.Rejection request);

    AppointmentResponse cancel(String id, AppointmentActionRequest.Cancellation request);

    AppointmentResponse complete(String id, AppointmentActionRequest.Completion request);

    AppointmentResponse noShow(String id, AppointmentActionRequest.NoShow request);

    AppointmentResponse correctResult(String id, AppointmentActionRequest.Correction request);
}
