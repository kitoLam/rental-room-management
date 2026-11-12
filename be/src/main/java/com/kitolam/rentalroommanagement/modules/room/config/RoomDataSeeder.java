package com.kitolam.rentalroommanagement.modules.room.config;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;

/**
 * 10 demo rooms (with their slots) in one branch. Opt-in via ROOM_SEED_ENABLED, and only creates
 * room numbers that do not exist in that branch yet, so it is safe to leave on.
 * Target branch: ROOM_SEED_BRANCH_ID, or the oldest ACTIVE branch.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.seed.rooms.enabled", havingValue = "true")
@RequiredArgsConstructor
public class RoomDataSeeder implements CommandLineRunner {

    private static final String IMG_1 = "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80";
    private static final String IMG_2 = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80";
    private static final String IMG_3 = "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80";

    private record Sample(String number, String title, int floor, int area, int occupants, int price,
                          List<String> amenities, List<String> images) {
    }

    private static final List<Sample> SAMPLES = List.of(
            new Sample("A101", "Phòng studio ban công thoáng", 1, 25, 2, 3_800_000,
                    List.of("Máy lạnh", "Ban công", "WC riêng", "Wi-Fi"), List.of(IMG_1, IMG_2, IMG_3)),
            new Sample("A102", "Phòng đơn yên tĩnh gần cửa sổ", 1, 18, 1, 2_600_000,
                    List.of("Máy lạnh", "Cửa sổ", "Wi-Fi"), List.of(IMG_2, IMG_3, IMG_1)),
            new Sample("A103", "Phòng ở ghép 4 người tiết kiệm", 1, 30, 4, 6_000_000,
                    List.of("Giường tầng", "Tủ đồ cá nhân", "Máy lạnh", "Wi-Fi"), List.of(IMG_3, IMG_1, IMG_2)),
            new Sample("A201", "Phòng gác lửng rộng rãi", 2, 32, 3, 4_500_000,
                    List.of("Gác lửng", "Máy lạnh", "Bếp nhỏ", "WC riêng"), List.of(IMG_1, IMG_3, IMG_2)),
            new Sample("A202", "Phòng đôi nội thất đầy đủ", 2, 24, 2, 3_900_000,
                    List.of("Giường đôi", "Tủ lạnh", "Máy lạnh", "Wi-Fi"), List.of(IMG_2, IMG_1, IMG_3)),
            new Sample("A203", "Phòng ở ghép 3 người cho sinh viên", 2, 28, 3, 4_200_000,
                    List.of("Bàn học", "Tủ đồ cá nhân", "Máy lạnh"), List.of(IMG_3, IMG_2, IMG_1)),
            new Sample("A301", "Căn hộ mini có bếp riêng", 3, 35, 2, 5_200_000,
                    List.of("Bếp riêng", "Máy giặt", "Máy lạnh", "Ban công"), List.of(IMG_1, IMG_2, IMG_3)),
            new Sample("A302", "Phòng đơn view thành phố", 3, 20, 1, 3_000_000,
                    List.of("View thành phố", "Máy lạnh", "Wi-Fi"), List.of(IMG_2, IMG_3, IMG_1)),
            new Sample("A303", "Phòng ký túc 6 người", 3, 40, 6, 7_200_000,
                    List.of("Giường tầng", "Tủ đồ cá nhân", "Máy lạnh", "Máy giặt chung"), List.of(IMG_3, IMG_1, IMG_2)),
            new Sample("A401", "Phòng tầng thượng sân phơi riêng", 4, 27, 2, 3_600_000,
                    List.of("Sân phơi riêng", "Máy lạnh", "WC riêng"), List.of(IMG_1, IMG_3, IMG_2))
    );

    /** Seeding runs as a system admin so the normal create flow (validation + slots) is reused. */
    private static final AuthPrincipal SYSTEM = new AuthPrincipal("system-seed", "seed@system.local", "ADMIN");

    private final MongoTemplate mongoTemplate;
    private final RoomService roomService;

    @Value("${app.seed.rooms.branch-id:}")
    private String branchId;

    @Override
    public void run(String... args) {
        String target = StringUtils.hasText(branchId) ? branchId : oldestActiveBranch();
        if (target == null) {
            log.warn("Room seed skipped: no ACTIVE branch found");
            return;
        }
        List<String> roomServiceIds = mongoTemplate.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("branchId").is(MongoQueryHelper.toObjectId(target)),
                        Criteria.where("status").is("ACTIVE"))),
                com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService.class)
                .stream().map(com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService::getId).toList();
        int created = 0;
        for (Sample sample : SAMPLES) {
            if (exists(target, sample.number())) {
                attachServices(target, sample.number(), roomServiceIds);
                continue;
            }
            roomService.create(new RoomCreateRequest(target, sample.title(), sample.number(), sample.floor(),
                    BigDecimal.valueOf(sample.area()), sample.occupants(), BigDecimal.valueOf(sample.price()),
                    BigDecimal.valueOf(sample.price()), sample.amenities(), sample.images(), roomServiceIds,
                    "Giữ yên lặng sau 22h. Không hút thuốc trong phòng. Khách ở lại qua đêm cần báo quản lý."), SYSTEM);
            created++;
        }
        log.info("Room seed: created {} rooms in branch {}", created, target);
    }

    /** Existing sample rooms without room services get every active service of the branch. */
    private void attachServices(String branchId, String roomNumber, List<String> roomServiceIds) {
        if (roomServiceIds.isEmpty()) return;
        mongoTemplate.updateFirst(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)),
                        Criteria.where("roomNumber").is(roomNumber),
                        new Criteria().orOperator(Criteria.where("roomServiceIds").exists(false), Criteria.where("roomServiceIds").size(0)))),
                new org.springframework.data.mongodb.core.query.Update().set("roomServiceIds",
                        roomServiceIds.stream().map(MongoQueryHelper::toObjectId).toList()), Room.class);
    }

    private String oldestActiveBranch() {
        Branch branch = mongoTemplate.findOne(new Query(new Criteria().andOperator(
                        MongoQueryHelper.notDeleted(), Criteria.where("status").is(BranchStatus.ACTIVE.name())))
                .with(Sort.by(Sort.Direction.ASC, "createdAt")), Branch.class);
        return branch == null ? null : branch.getId();
    }

    private boolean exists(String branchId, String roomNumber) {
        return mongoTemplate.exists(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)),
                Criteria.where("roomNumber").is(roomNumber))), Room.class);
    }
}
