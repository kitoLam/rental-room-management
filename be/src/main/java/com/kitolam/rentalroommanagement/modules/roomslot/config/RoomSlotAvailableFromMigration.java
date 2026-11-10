package com.kitolam.rentalroommanagement.modules.roomslot.config;

import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
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

    @Override
    public void run(String... args) {
        Criteria missing = Criteria.where("status").is(RoomSlotStatus.AVAILABLE)
                .and("isDeleted").is(false)
                .and("availableFrom").is(null);
        List<RoomSlot> candidates = mongoTemplate.find(Query.query(missing), RoomSlot.class);
        Set<String> inUse = occupiedSlotIds(candidates.stream().map(RoomSlot::getId).toList());
        int total = 0;
        for (RoomSlot slot : candidates) {
            if (inUse.contains(slot.getId())) continue;
            LocalDate date = BUCKETS.get(Math.floorMod(slot.getId().hashCode(), BUCKETS.size()));
            total += mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(new ObjectId(slot.getId()))
                    .and("availableFrom").is(null)), new Update().set("availableFrom", date), RoomSlot.class)
                    .getModifiedCount();
        }
        long remaining = mongoTemplate.count(Query.query(missing), RoomSlot.class);
        log.info("Room slot availableFrom migration finished: {} slots filled, {} still missing", total, remaining);
    }

    private Set<String> occupiedSlotIds(List<String> slotIds) {
        if (slotIds.isEmpty()) return Set.of();
        List<ObjectId> ids = slotIds.stream().filter(ObjectId::isValid).map(ObjectId::new).toList();
        return mongoTemplate.find(Query.query(Criteria.where("isDeleted").is(false)
                        .and("status").in(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE)
                        .and("roomSlotId").in(ids)), RoomSlotOccupancy.class)
                .stream().map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet());
    }
}