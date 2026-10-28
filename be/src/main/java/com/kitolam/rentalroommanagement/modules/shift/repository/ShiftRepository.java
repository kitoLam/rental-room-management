package com.kitolam.rentalroommanagement.modules.shift.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;

public interface ShiftRepository extends BaseRepository<Shift> {
    boolean existsByRoomIdAndIsDeletedFalse(String roomId);

    /** Acquires a document write fence inside the appointment transaction. */
    @Query("{'_id':?0,'version':?1,'isDeleted':false}")
    // Explicit version += 0 prevents MongoTemplate from auto-incrementing the @Version field.
    @Update("{$inc:{'appointmentFence':1,'version':0}}")
    long lockForAppointment(String roomId, Long version);
}
