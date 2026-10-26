package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;

/** Query parameters for search; all optional. */
public record AppointmentFilterRequest(
        @ValidObjectId String tenantId,
        @ValidObjectId String roomId,
        @ValidObjectId String shiftId,
        AppointmentStatus status
) {
}
