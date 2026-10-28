package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/** Query parameters for search; all optional. */
public record AppointmentFilterRequest(
        @ValidObjectId String branchId,
        @ValidObjectId String roomId,
        @ValidObjectId String shiftId,
        AppointmentStatus status,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
        Boolean needsResult
) {
    public AppointmentFilterRequest(String branchId, String roomId, String shiftId, AppointmentStatus status,
                                    LocalDate fromDate, LocalDate toDate) {
        this(branchId, roomId, shiftId, status, fromDate, toDate, null);
    }
}
