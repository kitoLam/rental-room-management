package com.kitolam.rentalroommanagement.modules.room.config;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * One-off data fix for rooms created before title / maxOccupants existed:
 * title = "Phòng {roomNumber}", maxOccupants = number of live slots (at least 1).
 * Only fills missing values; old fields (roomTypeId, managerId, room rates) are left untouched and ignored.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomFieldsBackfill implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;
    private final RoomSlotRepository roomSlotRepository;

    @Override
    public void run(ApplicationArguments args) {
        Query missing = new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(), new Criteria().orOperator(
                Criteria.where("title").exists(false), Criteria.where("maxOccupants").exists(false))));
        int fixed = 0;
        for (Room room : mongoTemplate.find(missing, Room.class)) {
            Update update = new Update();
            if (room.getTitle() == null) update.set("title", "Phòng " + room.getRoomNumber());
            if (room.getMaxOccupants() == null) {
                update.set("maxOccupants", Math.max(1, roomSlotRepository.findByRoomIdAndIsDeletedFalse(room.getId()).size()));
            }
            mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(MongoQueryHelper.toObjectId(room.getId()))), update, Room.class);
            fixed++;
        }
        if (fixed > 0) log.info("Backfilled title/maxOccupants on {} rooms", fixed);
    }
}
