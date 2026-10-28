package com.kitolam.rentalroommanagement.modules.appointment.dto.response;

import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;

public record AppointmentResponse(
        String id,
        String requesterAccountId,
        String branchId,
        String roomId,
        String shiftId,
        ShiftType shiftType,
        LocalDate appointmentDate,
        Instant startAt,
        Instant endAt,
        Instant expiresAt,
        String roomNumber,
        String branchName,
        String publicContactPhone,
        String contactName,
        String contactPhone,
        String rejectReason,
        String result,
        AppointmentStatus status,
        Instant createdAt,
        Instant updatedAt,
        List<HistoryItem> history,
        long actionVersion,
        String approvedByName,
        Instant approvedAt,
        String cancellationReason,
        com.kitolam.rentalroommanagement.modules.appointment.document.Appointment.CancellationCause cancellationCause,
        List<String> allowedActions
) {
    public record HistoryItem(String id, String action, String actorName, Instant at,
                              AppointmentStatus before, AppointmentStatus status, String reason,
                              String previousNote, String note,
                              com.kitolam.rentalroommanagement.modules.appointment.document.Appointment.CancellationCause cancellationCause,
                              List<String> relatedBookingIds, String sourceRevision) { }
}
