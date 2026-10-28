package com.kitolam.rentalroommanagement.modules.shift.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {
    private final ShiftRepository repository;

    @Override
    public void lockForAppointment(String roomId, Long version) {
        if (repository.lockForAppointment(roomId, version) != 1) {
            throw new ConflictException("Giờ ca đã thay đổi. Vui lòng tải lại ca trước khi gửi.", "SHIFT_VERSION_CONFLICT");
        }
    }

    @Override
    public Shift getForRoom(String roomId) {
        MongoQueryHelper.toObjectId(roomId);
        Shift existing = repository.findByIdAndIsDeletedFalse(roomId).orElse(null);
        if (existing != null) return validateStored(existing);
        if (repository.existsByRoomIdAndIsDeletedFalse(roomId)) {
            throw new ConflictException("Cấu hình ca cũ cần được chuyển đổi trước khi sử dụng");
        }
        Shift defaults = new Shift();
        defaults.setId(roomId);
        defaults.setRoomId(roomId);
        defaults.setPeriods(List.of(period(ShiftType.MORNING, "08:00", "10:00"),
                period(ShiftType.AFTERNOON, "14:00", "16:00"), period(ShiftType.EVENING, "18:00", "20:00")));
        try {
            return repository.insert(defaults);
        } catch (DuplicateKeyException race) {
            return validateStored(repository.findByIdAndIsDeletedFalse(roomId).orElseThrow(
                    () -> new ConflictException("Không thể khởi tạo cấu hình ca của phòng")));
        }
    }

    @Override
    public Shift updateForRoom(String roomId, ShiftUpdateRequest request) {
        validateInput(request);
        Shift current = getForRoom(roomId);
        if (!Objects.equals(current.getVersion(), request.version())) {
            throw versionConflict();
        }
        List<Shift.Period> updated = new ArrayList<>();
        for (ShiftType type : ShiftType.values()) {
            var input = request.periods().stream().filter(p -> p.type() == type).findFirst().orElseThrow();
            String id = current.getPeriods().stream().filter(p -> p.type() == type).findFirst().orElseThrow().id();
            updated.add(new Shift.Period(id, type, input.startTime(), input.endTime(), input.isActive()));
        }
        current.setPeriods(List.copyOf(updated));
        try {
            return repository.save(current);
        } catch (OptimisticLockingFailureException concurrentEdit) {
            throw versionConflict();
        }
    }

    private ConflictException versionConflict() {
        return new ConflictException("Cấu hình ca đã thay đổi. Hãy tải lại trước khi lưu.", "SHIFT_VERSION_CONFLICT");
    }

    private void validateInput(ShiftUpdateRequest request) {
        if (request == null || request.version() == null || request.version() < 0
                || request.periods() == null || request.periods().size() != 3) {
            throw new BadRequestException("Phải gửi phiên bản và đúng ba ca sáng, chiều, tối");
        }
        EnumSet<ShiftType> types = EnumSet.noneOf(ShiftType.class);
        for (var p : request.periods()) {
            if (p == null || p.type() == null || !types.add(p.type()) || p.isActive() == null
                    || p.startTime() == null || !p.startTime().matches("^([01]\\d|2[0-3]):[0-5]\\d$")
                    || p.endTime() == null || !p.endTime().matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
                throw new BadRequestException("Mỗi loại ca phải xuất hiện một lần với giờ HH:mm hợp lệ");
            }
            if (!LocalTime.parse(p.startTime()).isBefore(LocalTime.parse(p.endTime()))) {
                throw new BadRequestException("Giờ bắt đầu phải trước giờ kết thúc, ca không xuyên ngày");
            }
        }
        var sorted = request.periods().stream().sorted(Comparator.comparing(ShiftUpdateRequest.PeriodInput::startTime)).toList();
        for (int i = 1; i < sorted.size(); i++) {
            if (sorted.get(i).startTime().compareTo(sorted.get(i - 1).endTime()) < 0) {
                throw new BadRequestException("Các ca của cùng phòng không được chồng giờ, kể cả ca đang tắt");
            }
        }
    }

    private Shift validateStored(Shift shift) {
        if (!shift.getId().equals(shift.getRoomId()) || shift.getVersion() == null
                || shift.getPeriods() == null || shift.getPeriods().size() != 3) {
            throw new ConflictException("Cấu hình ca cũ cần được chuyển đổi trước khi sử dụng");
        }
        validateInput(new ShiftUpdateRequest(shift.getVersion(), shift.getPeriods().stream()
                .map(p -> new ShiftUpdateRequest.PeriodInput(p.type(), p.startTime(), p.endTime(), p.isActive())).toList()));
        if (shift.getPeriods().stream().map(Shift.Period::id).anyMatch(id -> id == null || !ObjectId.isValid(id))
                || shift.getPeriods().stream().map(Shift.Period::id).distinct().count() != 3) {
            throw new ConflictException("ID ca trong cấu hình không hợp lệ");
        }
        return shift;
    }

    private Shift.Period period(ShiftType type, String start, String end) {
        return new Shift.Period(new ObjectId().toHexString(), type, start, end, true);
    }
}
