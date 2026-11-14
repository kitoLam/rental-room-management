package com.kitolam.rentalroommanagement.modules.meterreading.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractTerminationSettlement.ElectricityClosing;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.request.MeterReadingSaveRequest;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterBoardResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterReadingResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;
import com.kitolam.rentalroommanagement.modules.meterreading.repository.RoomMeterReadingRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.service.MeterReadingService;
import com.kitolam.rentalroommanagement.modules.meterreading.support.RoomOccupancyCalendar;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeterReadingServiceImpl implements MeterReadingService {

    private final RoomMeterReadingRepository repository;
    private final RoomRepository roomRepository;
    private final BranchService branchService;
    private final StaffAccess staffAccess;
    private final Clock clock;
    private final RoomOccupancyCalendar occupancy;
    private final ContractRepository contracts;

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    public MeterBoardResponse board(String branchId, String period, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        String currentPeriod = currentPeriod();
        if (YearMonth.parse(period).isAfter(YearMonth.parse(currentPeriod))) {
            throw new BadRequestException("Không xem được chỉ số của tháng chưa tới");
        }
        boolean editable = period.equals(currentPeriod);
        BigDecimal rate = branchService.getById(branchId).electricityRate();
        List<Room> rooms = roomRepository.findByBranchIdAndIsDeletedFalse(branchId).stream()
                .sorted(Comparator.comparing(Room::getRoomNumber, Comparator.nullsLast(String::compareTo)))
                .toList();
        Map<String, RoomMeterReading> current = repository
                .findByRoomIdInAndPeriodAndIsDeletedFalse(rooms.stream().map(Room::getId).toList(), period).stream()
                .collect(Collectors.toMap(RoomMeterReading::getRoomId, Function.identity(), (a, b) -> a));
        Set<String> occupied = occupancy.occupiedRooms(rooms.stream().map(Room::getId).toList(), YearMonth.parse(period));
        List<MeterBoardResponse.Row> rows = new ArrayList<>();
        for (Room room : rooms) {
            BigDecimal previous = previousEnd(room.getId(), period);
            RoomMeterReading reading = current.get(room.getId());
            // New month: carry the previous end reading over as both start and end (usage 0) for every
            // room, occupied or not, so the meter chain never has a gap; staff correct occupied rooms.
            if (reading == null && editable && previous != null && rate != null) {
                reading = carryOver(room, period, previous, rate);
            }
            // Only rooms someone lived in during that month are shown / need a reading.
            if (!occupied.contains(room.getId())) continue;
            rows.add(new MeterBoardResponse.Row(room.getId(), room.getRoomNumber(), room.getTitle(), previous,
                    reading == null ? null : toResponse(reading)));
        }
        return new MeterBoardResponse(branchId, period, currentPeriod, editable, rate, rows);
    }

    @Override
    public MeterReadingResponse save(MeterReadingSaveRequest request, AuthPrincipal principal) {
        Room room = roomRepository.findByIdAndIsDeletedFalse(request.roomId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
        staffAccess.requireBranch(room.getBranchId(), principal);
        requireCurrentPeriod(request.period());
        if (!occupancy.occupiedRooms(List.of(room.getId()), YearMonth.parse(request.period())).contains(room.getId())) {
            throw new BadRequestException("Phòng " + room.getRoomNumber() + " không có người ở trong tháng này, không cần nhập chỉ số");
        }
        BigDecimal rate = branchService.getById(room.getBranchId()).electricityRate();
        if (rate == null) throw new BadRequestException("Chi nhánh chưa cấu hình giá điện");

        RoomMeterReading reading = repository.findByRoomIdAndPeriodAndIsDeletedFalse(room.getId(), request.period())
                .orElseGet(RoomMeterReading::new);
        if (reading.getStatus() == MeterReadingStatus.CONFIRMED) {
            throw new ConflictException("Chỉ số tháng " + request.period() + " đã chốt, mở lại để sửa");
        }
        BigDecimal start = request.startReading() != null ? request.startReading()
                : reading.getStartReading() != null ? reading.getStartReading()
                : previousEnd(room.getId(), request.period());
        ElectricityClosing closing = latestTerminationClosing(room.getId(), request.period());
        if (closing != null) {
            if (start != null && start.compareTo(closing.startReading()) != 0)
                throw new ConflictException("Chỉ số đầu kỳ phải khớp với quyết toán hợp đồng trong tháng.");
            start = closing.startReading();
            rate = closing.unitPrice();
            validateTerminationEnd(request.endReading(), closing);
        }
        if (start == null) throw new BadRequestException("Tháng đầu tiên của phòng cần nhập chỉ số đầu kỳ");
        BigDecimal usage = request.endReading().subtract(start);
        if (usage.signum() < 0) throw new BadRequestException("Chỉ số cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ");

        fill(reading, room, request.period(), start, request.endReading(), rate,
                StringUtils.hasText(request.note()) ? request.note().trim() : null);
        return toResponse(repository.save(reading));
    }

    @Override
    public MeterReadingResponse confirm(String id, AuthPrincipal principal) {
        RoomMeterReading reading = getEntity(id);
        staffAccess.requireBranch(reading.getBranchId(), principal);
        if (reading.getStatus() == MeterReadingStatus.CONFIRMED) throw new ConflictException("Chỉ số đã được chốt");
        ElectricityClosing closing = latestTerminationClosing(reading.getRoomId(), reading.getPeriod());
        if (closing != null) {
            validateTerminationEnd(reading.getEndReading(), closing);
            if (reading.getStartReading() == null || reading.getStartReading().compareTo(closing.startReading()) != 0
                    || reading.getUnitPrice() == null || reading.getUnitPrice().compareTo(closing.unitPrice()) != 0)
                throw new ConflictException("Vui lòng cập nhật chỉ số tháng cho khớp với quyết toán hợp đồng.");
        }
        reading.setStatus(MeterReadingStatus.CONFIRMED);
        return toResponse(repository.save(reading));
    }

    @Override
    public MeterReadingResponse reopen(String id, AuthPrincipal principal) {
        RoomMeterReading reading = getEntity(id);
        staffAccess.requireBranch(reading.getBranchId(), principal);
        if (reading.getStatus() != MeterReadingStatus.CONFIRMED) throw new ConflictException("Chỉ số chưa chốt");
        requireCurrentPeriod(reading.getPeriod());
        String next = YearMonth.parse(reading.getPeriod()).plusMonths(1).toString();
        if (repository.findByRoomIdAndPeriodAndIsDeletedFalse(reading.getRoomId(), next).isPresent()) {
            throw new ConflictException("Tháng sau đã có chỉ số, không thể mở lại");
        }
        reading.setStatus(MeterReadingStatus.DRAFT);
        return toResponse(repository.save(reading));
    }

    private String currentPeriod() {
        return YearMonth.now(clock.withZone(VIETNAM)).toString();
    }

    private ElectricityClosing latestTerminationClosing(String roomId, String period) {
        return contracts.findByRoomIdInAndIsDeletedFalse(List.of(roomId)).stream()
                .map(Contract::getTerminationSettlement)
                .filter(settlement -> settlement != null && period.equals(YearMonth.from(settlement.lastRentalDate()).toString()))
                .map(settlement -> settlement.electricity())
                .max(Comparator.comparing(ElectricityClosing::endReading)).orElse(null);
    }

    private void validateTerminationEnd(BigDecimal end, ElectricityClosing closing) {
        if (end == null || end.compareTo(closing.endReading()) < 0)
            throw new ConflictException("Chỉ số cuối kỳ không được thấp hơn chỉ số đã chốt khi hủy hợp đồng.");
    }

    /** Readings can only be entered / changed for the current month; earlier months are history. */
    private void requireCurrentPeriod(String period) {
        String current = currentPeriod();
        if (!current.equals(period)) {
            throw new BadRequestException("Chỉ được nhập / sửa chỉ số điện của tháng hiện tại (" + current + ")");
        }
    }

    /** Two board loads can race on the (roomId, period) unique index: the loser re-reads the winner. */
    private RoomMeterReading carryOver(Room room, String period, BigDecimal previous, BigDecimal rate) {
        try {
            return repository.save(draft(room, period, previous, previous, rate, null));
        } catch (DuplicateKeyException e) {
            return repository.findByRoomIdAndPeriodAndIsDeletedFalse(room.getId(), period).orElseThrow(() -> e);
        }
    }

    private RoomMeterReading draft(Room room, String period, BigDecimal start, BigDecimal end, BigDecimal rate, String note) {
        RoomMeterReading reading = new RoomMeterReading();
        fill(reading, room, period, start, end, rate, note);
        return reading;
    }

    private void fill(RoomMeterReading reading, Room room, String period, BigDecimal start, BigDecimal end,
                      BigDecimal rate, String note) {
        BigDecimal usage = end.subtract(start);
        reading.setRoomId(room.getId());
        reading.setBranchId(room.getBranchId());
        reading.setPeriod(period);
        reading.setStartReading(start);
        reading.setEndReading(end);
        reading.setUsage(usage);
        reading.setUnitPrice(rate);
        reading.setAmount(usage.multiply(rate).setScale(0, RoundingMode.HALF_UP));
        reading.setNote(note);
    }

    private BigDecimal previousEnd(String roomId, String period) {
        return repository.findFirstByRoomIdAndPeriodLessThanAndIsDeletedFalseOrderByPeriodDesc(roomId, period)
                .map(RoomMeterReading::getEndReading)
                .orElse(null);
    }

    private RoomMeterReading getEntity(String id) {
        return repository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy chỉ số"));
    }

    private MeterReadingResponse toResponse(RoomMeterReading r) {
        return new MeterReadingResponse(r.getId(), r.getRoomId(), r.getBranchId(), r.getPeriod(), r.getStartReading(),
                r.getEndReading(), r.getUsage(), r.getUnitPrice(), r.getAmount(), r.getStatus(), r.getNote(), r.getUpdatedAt());
    }
}
