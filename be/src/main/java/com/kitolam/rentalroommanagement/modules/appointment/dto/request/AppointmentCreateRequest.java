package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record AppointmentCreateRequest(
        @NotBlank @ValidObjectId String tenantId,
        @NotBlank @ValidObjectId String roomId,
        @NotBlank @ValidObjectId String shiftId,
        @NotNull LocalDate appointmentDate,
        @ValidObjectId String proposedShiftId,
        LocalDate proposedDate,
        String note,
        String rejectReason,
        String result
) {
}
