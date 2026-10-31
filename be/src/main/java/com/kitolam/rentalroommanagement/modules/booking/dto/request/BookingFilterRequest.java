package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import java.time.LocalDate;

/** Query parameters for search; all optional. */
public record BookingFilterRequest(
        @ValidObjectId String tenantId,
        @ValidObjectId String roomSlotId,
        @ValidObjectId String roomId,
        LocalDate from,
        LocalDate to,
        String q,
        DepositStatus depositStatus,
        BookingStatus status
) {
}
