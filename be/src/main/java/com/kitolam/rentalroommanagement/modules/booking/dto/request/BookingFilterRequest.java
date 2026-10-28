package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;

/** Query parameters for search; all optional. */
public record BookingFilterRequest(
        @ValidObjectId String tenantId,
        @ValidObjectId String roomSlotId,
        DepositStatus depositStatus,
        BookingStatus status
) {
}
