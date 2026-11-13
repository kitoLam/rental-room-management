package com.kitolam.rentalroommanagement.modules.meterreading.config;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;
import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;
import com.kitolam.rentalroommanagement.modules.meterreading.support.RoomOccupancyCalendar;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Demo electricity history. Opt-in (METER_SEED_ENABLED): wipes every meter reading, then rebuilds the
 * last {@link #MONTHS} months for every room:
 * <ul>
 *   <li>months the room was occupied (per contracts): 60–220 kWh of usage;</li>
 *   <li>vacant months: carry-over of the previous end reading (usage 0);</li>
 *   <li>earlier months CONFIRMED; the current month DRAFT, where every other occupied room is left at
 *       start = end to show the "forgot the end reading" highlight.</li>
 * </ul>
 * Branches without an electricity rate get {@link #DEFAULT_RATE}. Turn the flag off after one run.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.seed.meter-readings.enabled", havingValue = "true")
@RequiredArgsConstructor
public class MeterReadingSeeder implements CommandLineRunner {

    private static final int MONTHS = 6;
    private static final BigDecimal DEFAULT_RATE = BigDecimal.valueOf(3_500);
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final MongoTemplate mongoTemplate;
    private final ContractRepository contractRepository;
    private final RoomOccupancyCalendar occupancy;
    private final Clock clock;

    @Override
    public void run(String... args) {
        long removed = mongoTemplate.remove(new Query(), RoomMeterReading.class).getDeletedCount();

        Map<String, Branch> branches = mongoTemplate.find(new Query(MongoQueryHelper.notDeleted()), Branch.class).stream()
                .collect(Collectors.toMap(Branch::getId, b -> b));
        for (Branch branch : branches.values()) {
            if (branch.getElectricityRate() == null) {
                branch.setElectricityRate(DEFAULT_RATE);
                mongoTemplate.save(branch);
            }
        }

        List<Room> rooms = mongoTemplate.find(new Query(MongoQueryHelper.notDeleted()), Room.class).stream()
                .filter(r -> r.getBranchId() != null && branches.containsKey(r.getBranchId()))
                .sorted(Comparator.comparing(Room::getRoomNumber, Comparator.nullsLast(String::compareTo)))
                .toList();
        List<Contract> contracts = contractRepository.findByRoomIdInAndIsDeletedFalse(rooms.stream().map(Room::getId).toList());

        YearMonth current = YearMonth.now(clock.withZone(VIETNAM));
        YearMonth first = current.minusMonths(MONTHS - 1L);
        int created = 0;
        int occupiedCells = 0;
        int index = 0;
        for (Room room : rooms) {
            Random random = new Random(room.getId().hashCode());
            BigDecimal rate = branches.get(room.getBranchId()).getElectricityRate();
            BigDecimal reading = BigDecimal.valueOf(1_000 + random.nextInt(4_000));
            boolean forgetsThisMonth = index++ % 2 == 1;
            for (YearMonth month = first; !month.isAfter(current); month = month.plusMonths(1)) {
                Set<String> occupied = occupancy.occupiedRooms(contracts, month);
                boolean isOccupied = occupied.contains(room.getId());
                boolean isCurrent = month.equals(current);
                int usage = !isOccupied || (isCurrent && forgetsThisMonth) ? 0 : 60 + random.nextInt(161);
                BigDecimal end = reading.add(BigDecimal.valueOf(usage));
                mongoTemplate.save(reading(room, month, reading, end, rate,
                        isCurrent ? MeterReadingStatus.DRAFT : MeterReadingStatus.CONFIRMED));
                reading = end;
                created++;
                if (isOccupied) occupiedCells++;
            }
        }
        log.info("Meter reading seed: removed {}, created {} readings for {} rooms over {}..{} ({} occupied room-months)",
                removed, created, rooms.size(), first, current, occupiedCells);
    }

    private RoomMeterReading reading(Room room, YearMonth month, BigDecimal start, BigDecimal end, BigDecimal rate,
                                     MeterReadingStatus status) {
        BigDecimal usage = end.subtract(start);
        RoomMeterReading r = new RoomMeterReading();
        r.setRoomId(room.getId());
        r.setBranchId(room.getBranchId());
        r.setPeriod(month.toString());
        r.setStartReading(start);
        r.setEndReading(end);
        r.setUsage(usage);
        r.setUnitPrice(rate);
        r.setAmount(usage.multiply(rate).setScale(0, RoundingMode.HALF_UP));
        r.setStatus(status);
        return r;
    }
}
