package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface RoomSlotOccupancyRepository extends BaseRepository<RoomSlotOccupancy> {
    List<RoomSlotOccupancy> findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateGreaterThanAndIsDeletedFalse(
            String roomSlotId, Collection<OccupancyStatus> statuses, LocalDate requestedEnd, LocalDate requestedStart);

    List<RoomSlotOccupancy> findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateIsNullAndIsDeletedFalse(
            String roomSlotId, Collection<OccupancyStatus> statuses, LocalDate requestedEnd);

    List<RoomSlotOccupancy> findByRoomSlotIdInAndStatusInAndStartDateLessThanAndEndDateGreaterThanAndIsDeletedFalse(
            Collection<String> roomSlotIds, Collection<OccupancyStatus> statuses, LocalDate requestedEnd, LocalDate requestedStart);

    List<RoomSlotOccupancy> findByRoomSlotIdInAndStatusInAndIsDeletedFalse(
            Collection<String> roomSlotIds, Collection<OccupancyStatus> statuses);

    List<RoomSlotOccupancy> findByRoomSlotIdInAndStatusInAndStartDateLessThanAndEndDateIsNullAndIsDeletedFalse(
            Collection<String> roomSlotIds, Collection<OccupancyStatus> statuses, LocalDate requestedEnd);

    List<RoomSlotOccupancy> findByBookingIdAndIsDeletedFalse(String bookingId);
}
