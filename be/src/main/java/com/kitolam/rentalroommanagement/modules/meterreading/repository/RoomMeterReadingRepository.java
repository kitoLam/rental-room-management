package com.kitolam.rentalroommanagement.modules.meterreading.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RoomMeterReadingRepository extends BaseRepository<RoomMeterReading> {

    Optional<RoomMeterReading> findByRoomIdAndPeriodAndIsDeletedFalse(String roomId, String period);

    /** Latest earlier month (yyyy-MM sorts as text). */
    Optional<RoomMeterReading> findFirstByRoomIdAndPeriodLessThanAndIsDeletedFalseOrderByPeriodDesc(String roomId, String period);

    List<RoomMeterReading> findByRoomIdAndPeriodInAndIsDeletedFalse(String roomId, Collection<String> periods);

    List<RoomMeterReading> findByRoomIdInAndPeriodAndIsDeletedFalse(Collection<String> roomIds, String period);
}
