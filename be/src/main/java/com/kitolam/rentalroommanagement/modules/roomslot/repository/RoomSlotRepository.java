package com.kitolam.rentalroommanagement.modules.roomslot.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import java.util.Collection;
import java.util.List;

public interface RoomSlotRepository extends BaseRepository<RoomSlot> {
    List<RoomSlot> findByRoomIdAndIsDeletedFalse(String roomId);

    List<RoomSlot> findByRoomIdInAndIsDeletedFalse(Collection<String> roomIds);

    List<RoomSlot> findByIdInAndIsDeletedFalse(Collection<String> ids);
}
