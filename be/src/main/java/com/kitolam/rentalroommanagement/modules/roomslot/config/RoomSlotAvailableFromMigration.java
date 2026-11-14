package com.kitolam.rentalroommanagement.modules.roomslot.config;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.service.support.RoomSlotAvailabilityRoller;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Backfill availableFrom cho slot AVAILABLE đang thiếu field (chia đều 3 mốc ngày theo hash id).
 * Chỉ ghi vào document chưa có field nên chạy lại nhiều lần không đổi dữ liệu đã có.
 * Mặc định tắt; bật bằng app.migration.room-slot-available-from.enabled=true.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.migration.room-slot-available-from.enabled", havingValue = "true")
public class RoomSlotAvailableFromMigration implements CommandLineRunner {

    private static final List<LocalDate> BUCKETS = List.of(
            LocalDate.of(2026, 12, 30),
            LocalDate.of(2026, 12, 15),
            LocalDate.of(2026, 12, 1));

    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    @Override
    public void run(String... args) {
        Criteria missing = Criteria.where("status").is(RoomSlotStatus.AVAILABLE)
                .and("isDeleted").is(false)
                .and("depositPaused").ne(true)
                .and("availableFrom").is(null);
        List<RoomSlot> candidates = mongoTemplate.find(Query.query(missing), RoomSlot.class);
        if (candidates.isEmpty()) return;
        Query openRooms = MongoQueryHelper.byReferenceIds("_id", candidates.stream().map(RoomSlot::getRoomId).distinct().toList());
        openRooms.addCriteria(Criteria.where("status").in(RoomStatus.AVAILABLE, RoomStatus.RESERVED, RoomStatus.OCCUPIED));
        Set<String> openRoomIds = mongoTemplate.find(openRooms, Room.class).stream().map(Room::getId).collect(Collectors.toSet());
        Set<String> inUse = occupiedSlotIds(candidates.stream().map(RoomSlot::getId).toList());
        LocalDate today = RoomSlotAvailabilityRoller.todayVietnam(clock);
        int total = 0;
        for (RoomSlot slot : candidates) {
            if (inUse.contains(slot.getId()) || !openRoomIds.contains(slot.getRoomId())) continue;
            LocalDate bucket = BUCKETS.get(Math.floorMod(slot.getId().hashCode(), BUCKETS.size()));
            LocalDate date = RoomSlotAvailabilityRoller.requireFuture(
                    RoomSlotAvailabilityRoller.rollForward(bucket, today.plusDays(1)), today);
            total += mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(new ObjectId(slot.getId()))
                    .and("isDeleted").is(false).and("status").is(RoomSlotStatus.AVAILABLE)
                    .and("depositPaused").ne(true).and("version").is(slot.getVersion())
                    .and("availableFrom").is(null)), new Update().set("availableFrom", date)
                    .set("updatedAt", clock.instant())
                    .set("version", slot.getVersion() == null ? 0L : slot.getVersion() + 1), RoomSlot.class)
                    .getModifiedCount();
        }
        long remaining = mongoTemplate.count(Query.query(missing), RoomSlot.class);
        log.info("Room slot availableFrom migration finished: {} slots filled, {} still missing", total, remaining);
    }

    private Set<String> occupiedSlotIds(List<String> slotIds) {
        if (slotIds.isEmpty()) return Set.of();
        Query query = MongoQueryHelper.byReferenceIds("roomSlotId", slotIds)
                .addCriteria(Criteria.where("status").in(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE));
        return mongoTemplate.find(query, RoomSlotOccupancy.class)
                .stream().map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet());
    }
}
