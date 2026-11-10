package com.kitolam.rentalroommanagement.modules.roomservicecharge.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.document.RoomServiceCharge;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RoomServiceChargeRepository extends BaseRepository<RoomServiceCharge> {

    Optional<RoomServiceCharge> findByRoomServiceIdAndPeriodAndIsDeletedFalse(String roomServiceId, String period);

    /** Latest earlier reading, used as the default previousReading. Periods are yyyy-MM so string order = time order. */
    Optional<RoomServiceCharge> findFirstByRoomServiceIdAndPeriodLessThanAndStatusInAndIsDeletedFalseOrderByPeriodDesc(
            String roomServiceId, String period, Collection<RoomServiceChargeStatus> statuses);

    List<RoomServiceCharge> findByRoomServiceIdInAndPeriodAndIsDeletedFalse(Collection<String> roomServiceIds, String period);
}
