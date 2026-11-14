package com.kitolam.rentalroommanagement.modules.slotservice.config;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Demo room / slot service catalogs for every ACTIVE branch. Opt-in (SERVICE_SEED_ENABLED) and only
 * adds names a branch does not have yet, so staff edits are never overwritten.
 */
@Slf4j
@Component
@org.springframework.core.annotation.Order(10)
@ConditionalOnProperty(name = "app.seed.services.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ServiceCatalogSeeder implements CommandLineRunner {

    private record RoomItem(String name, int price, String description) {
    }

    private record SlotItem(String name, int price, String description) {
    }

    private static final List<RoomItem> ROOM_ITEMS = List.of(
            new RoomItem("Wi-Fi", 100_000, "Internet cáp quang dùng chung trong phòng"),
            new RoomItem("Vệ sinh / rác", 30_000, "Thu gom rác hằng ngày"),
            new RoomItem("Thang máy", 20_000, "Bảo trì và vận hành thang máy"),
            new RoomItem("Nước sinh hoạt", 100_000, "Khoán theo đầu người")
    );

    private static final List<SlotItem> SLOT_ITEMS = List.of(
            new SlotItem("Gửi xe máy", 100_000, "Chỗ để xe trong hầm, có bảo vệ"),
            new SlotItem("Giặt sấy", 80_000, "Giặt sấy không giới hạn tại phòng giặt chung"),
            new SlotItem("Tủ đồ cá nhân", 50_000, "Tủ có khoá riêng"),
            new SlotItem("Dọn phòng định kỳ", 120_000, "Dọn phần chỗ ở của bạn mỗi tuần một lần")
    );

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(String... args) {
        List<Branch> branches = mongoTemplate.find(new Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(), Criteria.where("status").is(BranchStatus.ACTIVE.name()))), Branch.class);
        int created = 0;
        for (Branch branch : branches) {
            for (RoomItem item : ROOM_ITEMS) {
                if (exists(RoomService.class, branch.getId(), item.name())) continue;
                RoomService service = new RoomService();
                service.setBranchId(branch.getId());
                service.setName(item.name());
                service.setUnitPrice(BigDecimal.valueOf(item.price()));
                service.setDescription(item.description());
                mongoTemplate.save(service);
                created++;
            }
            for (SlotItem item : SLOT_ITEMS) {
                if (exists(SlotService.class, branch.getId(), item.name())) continue;
                SlotService service = new SlotService();
                service.setBranchId(branch.getId());
                service.setName(item.name());
                service.setUnitPrice(BigDecimal.valueOf(item.price()));
                service.setDescription(item.description());
                mongoTemplate.save(service);
                created++;
            }
        }
        log.info("Service catalog seed: created {} entries for {} branches", created, branches.size());
    }

    private boolean exists(Class<?> type, String branchId, String name) {
        return mongoTemplate.exists(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)),
                Criteria.where("name").is(name))), type);
    }
}
