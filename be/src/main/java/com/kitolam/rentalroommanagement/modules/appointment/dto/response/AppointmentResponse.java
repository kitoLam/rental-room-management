package com.kitolam.rentalroommanagement.modules.appointment.dto.response;

import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;

import java.time.Instant;
import java.time.LocalDate;

public record AppointmentResponse(
        String id,
        String tenantId,
        String roomId,
        String shiftId,
        LocalDate appointmentDate,
        String proposedShiftId,
        LocalDate proposedDate,
        String note,
        String rejectReason,
        String result,
        AppointmentStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
