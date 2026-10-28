package com.kitolam.rentalroommanagement.modules.booking.event;

import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;

public record BookingStatusChangedEvent(
        String bookingId,
        String tenantId,
        BookingStatus status,
        DepositStatus depositStatus,
        String note
) {
}
