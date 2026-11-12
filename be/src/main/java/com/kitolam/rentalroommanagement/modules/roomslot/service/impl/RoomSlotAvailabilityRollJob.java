package com.kitolam.rentalroommanagement.modules.roomslot.service.impl;

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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Dời {@code availableFrom} của slot AVAILABLE thêm 7 ngày mỗi khi ngày đó đã qua, theo giờ Việt Nam.
 * Slot đang được giữ chỗ/đang thuê (có occupancy RESERVED/ACTIVE) không bị đụng tới.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSlotAvailabilityRollJob {

    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    @Scheduled(cron = "${room-slot.availability.roll-cron:0 0 0 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void rollOverdueAvailableFrom() {
        LocalDate today = RoomSlotAvailabilityRoller.todayVietnam(clock);
        int rolled;
        try {
            rolled = rollBatch(today);
        } catch (RuntimeException unavailable) {
            log.warn("Room slot availability roll could not finish", unavailable);
            return;
        }
        if (rolled > 0) log.info("Rolled availableFrom +7 days for {} room slots", rolled);
    }

    /** Trả về số slot đã dời; public để chạy tay/kiểm thử. */
    public int rollBatch(LocalDate today) {
        List<RoomSlot> due = mongoTemplate.find(Query.query(Criteria.where("status").is(RoomSlotStatus.AVAILABLE)
                .and("isDeleted").is(false)
                .and("availableFrom").lt(today)), RoomSlot.class);
        if (due.isEmpty()) return 0;
        Set<String> blocked = occupiedSlotIds(due.stream().map(RoomSlot::getId).toList());
        int rolled = 0;
        for (RoomSlot slot : due) {
            if (blocked.contains(slot.getId())) continue;
            LocalDate next = RoomSlotAvailabilityRoller.rollForward(slot.getAvailableFrom(), today);
            // CAS theo version: nếu booking vừa claim slot này (bump @Version) thì bỏ qua, chu kỳ sau xử lý.
            Criteria criteria = Criteria.where("_id").is(new ObjectId(slot.getId()))
                    .and("isDeleted").is(false)
                    .and("availableFrom").lt(today);
            if (slot.getVersion() != null) criteria.and("version").is(slot.getVersion());
            Update update = new Update().set("availableFrom", next)
                    .set("updatedAt", clock.instant())
                    .inc("version", 1);
            long matched = mongoTemplate.updateFirst(Query.query(criteria), update, RoomSlot.class).getMatchedCount();
            if (matched > 0) rolled++;
        }
        return rolled;
    }

    private Set<String> occupiedSlotIds(List<String> slotIds) {
        List<ObjectId> ids = slotIds.stream().filter(ObjectId::isValid).map(ObjectId::new).toList();
        return mongoTemplate.find(Query.query(Criteria.where("isDeleted").is(false)
                        .and("status").in(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE)
                        .and("roomSlotId").in(ids)), RoomSlotOccupancy.class)
                .stream().map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet());
    }
}