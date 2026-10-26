package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;

import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record AppointmentUpdateRequest(
        @ValidObjectId String shiftId,
        LocalDate appointmentDate,
        @ValidObjectId String proposedShiftId,
        LocalDate proposedDate,
        String note,
        String rejectReason,
        String result,
        AppointmentStatus status
) {
}
