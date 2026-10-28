package com.kitolam.rentalroommanagement.modules.booking.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends BaseRepository<Booking> {
    List<Booking> findByRoomSlotIdAndStatusInAndExpectedMoveInDateLessThanAndExpectedMoveOutDateGreaterThanAndIsDeletedFalse(
            String roomSlotId, Collection<BookingStatus> statuses, LocalDate requestedEnd, LocalDate requestedStart);

    List<Booking> findByRoomSlotIdAndStatusInAndIsDeletedFalse(String roomSlotId, Collection<BookingStatus> statuses);

    List<Booking> findByStatusAndHoldExpiresAtLessThanEqualAndIsDeletedFalse(BookingStatus status, java.time.Instant now);

    List<Booking> findByStatusAndPaymentDeadlineLessThanEqualAndIsDeletedFalse(BookingStatus status, java.time.Instant now);

    Optional<Booking> findByIdAndTenantIdAndIsDeletedFalse(String id, String tenantId);

    Optional<Booking> findByRoomSlotIdAndTenantIdAndExpectedMoveInDateAndExpectedMoveOutDateAndStatusAndIsDeletedFalse(
            String roomSlotId, String tenantId, LocalDate startDate, LocalDate endDate, BookingStatus status);
}
