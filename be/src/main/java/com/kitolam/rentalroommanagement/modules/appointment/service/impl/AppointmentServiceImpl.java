package com.kitolam.rentalroommanagement.modules.appointment.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.AppException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftBulkUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.BranchShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse.RoomResult;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse.Status;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.service.ShiftService;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentActionRequest;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment.CancellationCause;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingContextResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingEligibilityResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingEligibilityResponse.Reason;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.Actor;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingInventoryGateway;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationScope;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Objects;
import java.util.HexFormat;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final AppointmentAccessService access;
    private final ViewingInventoryGateway inventory;
    private final ShiftService shiftService;
    private final Clock viewingClock;
    private final AppointmentMapper appointmentMapper;
    private final AppointmentNotificationSupport notificationSupport;
    private final NotificationService notificationService;
    private static final ZoneId VIEWING_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    public PagedResponse<BranchShiftResponse> branchShiftConfigurations(String branchId, int page, int size) {
        String branch = MongoQueryHelper.toObjectId(branchId).toHexString();
        requireBranchManager(branch);
        if (page < 1 || size < 1 || size > 100) throw new BadRequestException("Trang phải từ 1, tối đa 100 phòng/trang");
        var rooms = inventory.roomsInBranch(branch, PageRequest.of(page - 1, size, Sort.by("roomId")));
        if (rooms.getContent().stream().anyMatch(room -> !branch.equals(room.branchId()))) {
            throw new IllegalStateException("Room source returned inconsistent branch membership");
        }
        return PagedResponse.from(rooms, room -> {
            try {
                Shift schedule = shiftService.getForRoom(room.roomId());
                return new BranchShiftResponse(room.roomId(), room.roomNumber(), room.branchName(),
                        schedule.getVersion(), schedule.getPeriods(), null, null);
            } catch (AppException ex) {
                return new BranchShiftResponse(room.roomId(), room.roomNumber(), room.branchName(), null,
                        List.of(), errorCode(ex), ex.getMessage());
            } catch (DataAccessException ex) {
                log.warn("Cannot load viewing schedule for room {}", room.roomId(), ex);
                return new BranchShiftResponse(room.roomId(), room.roomNumber(), room.branchName(), null,
                        List.of(), "SCHEDULE_UNAVAILABLE", "Chưa tải được cấu hình. Vui lòng thử lại.");
            }
        });
    }

    @Override
    public ShiftBulkUpdateResponse updateBranchShifts(String branchId, ShiftBulkUpdateRequest request) {
        String branch = MongoQueryHelper.toObjectId(branchId).toHexString();
        requireBranchManager(branch);
        validateBulkRequest(request); // Entire payload is checked before any room is touched.
        List<RoomResult> results = new ArrayList<>();
        for (var target : request.rooms()) {
            String roomId = MongoQueryHelper.toObjectId(target.roomId()).toHexString();
            String roomNumber = null;
            Shift saved;
            Shift.Period previous;
            try {
                // Re-resolve current membership; never authorize using FE-selected IDs alone.
                ViewingRoomSnapshot room = inventory.getRoom(roomId);
                if (!branch.equals(room.branchId())) {
                    throw new ForbiddenException("Phòng không thuộc chi nhánh được chọn", "ROOM_OUTSIDE_BRANCH");
                }
                roomNumber = room.roomNumber();
                Shift current = shiftService.getForRoom(roomId);
                if (!Objects.equals(current.getVersion(), target.version())) {
                    throw new ConflictException("Cấu hình đã thay đổi. Tải lại trước khi thử lại.", "SHIFT_VERSION_CONFLICT");
                }
                previous = current.getPeriods().stream().filter(p -> p.type() == request.type()).findFirst().orElseThrow();
                if (previous.startTime().equals(request.startTime()) && previous.endTime().equals(request.endTime())) {
                    results.add(new RoomResult(roomId, roomNumber, Status.UNCHANGED, current.getVersion(), null,
                            "Giờ của ca đã đúng với yêu cầu", List.of()));
                    continue;
                }
                var periods = current.getPeriods().stream().map(p -> new ShiftUpdateRequest.PeriodInput(p.type(),
                        p.type() == request.type() ? request.startTime() : p.startTime(),
                        p.type() == request.type() ? request.endTime() : p.endTime(), p.isActive())).toList();
                saved = shiftService.updateForRoom(roomId, new ShiftUpdateRequest(target.version(), periods));
            } catch (AppException ex) {
                results.add(new RoomResult(roomId, roomNumber, Status.FAILED, null, errorCode(ex), ex.getMessage(), List.of()));
                continue;
            } catch (RuntimeException ex) {
                // A connection error can leave the write result unknown; never blindly retry/rebase.
                log.warn("Bulk viewing schedule write could not be confirmed for room {}", roomId, ex);
                results.add(new RoomResult(roomId, roomNumber, Status.FAILED, null, "WRITE_RESULT_UNCONFIRMED",
                        "Chưa xác nhận được kết quả lưu. Tải lại cấu hình trước khi thử lại.", List.of()));
                continue;
            }
            List<ShiftResponse.ExistingAppointment> affected = List.of();
            String code = null;
            String message = "Đã cập nhật giờ ca; các lịch đã đặt giữ nguyên giờ";
            try {
                affected = upcomingAppointments(roomId, viewingClock.instant()).stream()
                        .filter(a -> previous.id().equals(a.getShiftId()) || a.getShiftType() == request.type()
                                || a.getStartAt() == null || a.getEndAt() == null)
                        .map(this::existingAppointment).toList();
            } catch (RuntimeException ex) {
                // The configuration HAS been saved; a warning read failure must not report a failed write.
                log.warn("Cannot load affected viewing appointments for room {}", roomId, ex);
                code = "APPOINTMENT_WARNING_UNAVAILABLE";
                message = "Đã lưu cấu hình; chưa tải được lịch bị ảnh hưởng. Mở cấu hình riêng để kiểm tra.";
            }
            results.add(new RoomResult(roomId, roomNumber, Status.UPDATED, saved.getVersion(), code, message, affected));
        }
        return ShiftBulkUpdateResponse.from(branch, results);
    }

    private void requireBranchManager(String branchId) {
        if (!requireActiveAccount().canManage(branchId)) {
            throw new ForbiddenException("Không có quyền quản lý lịch xem của chi nhánh này");
        }
    }

    private void validateBulkRequest(ShiftBulkUpdateRequest request) {
        if (request == null || request.type() == null || request.startTime() == null || request.endTime() == null
                || !request.startTime().matches("^([01]\\d|2[0-3]):[0-5]\\d$")
                || !request.endTime().matches("^([01]\\d|2[0-3]):[0-5]\\d$")
                || !LocalTime.parse(request.startTime()).isBefore(LocalTime.parse(request.endTime()))
                || request.rooms() == null || request.rooms().isEmpty() || request.rooms().size() > 100) {
            throw new BadRequestException("Chọn một ca, giờ hợp lệ và từ 1 đến 100 phòng mỗi lượt gửi");
        }
        Set<String> unique = new HashSet<>();
        for (var room : request.rooms()) {
            if (room == null || room.version() == null || room.version() < 0
                    || !unique.add(MongoQueryHelper.toObjectId(room.roomId()).toHexString())) {
                throw new BadRequestException("Danh sách phòng phải có phiên bản hợp lệ và không được trùng ID");
            }
        }
    }

    private String errorCode(AppException ex) {
        if (ex.getErrorCode() != null) return ex.getErrorCode();
        return switch (ex.getStatus().value()) {
            case 400 -> "SHIFT_CONFIGURATION_INVALID";
            case 403 -> "FORBIDDEN";
            case 404 -> "ROOM_NOT_FOUND";
            case 409 -> "SHIFT_CONFLICT";
            default -> "UPDATE_FAILED";
        };
    }

    @Override
    public ShiftResponse shiftConfiguration(String roomId) {
        requireManager(roomId);
        Shift configuration = shiftService.getForRoom(roomId);
        return scheduleResponse(configuration, upcomingAppointments(roomId, viewingClock.instant()));
    }

    @Override
    public ShiftResponse updateShiftConfiguration(String roomId, ShiftUpdateRequest request) {
        requireManager(roomId);
        Shift before = shiftService.getForRoom(roomId);
        var previous = List.copyOf(before.getPeriods());
        Shift saved = shiftService.updateForRoom(roomId, request);
        Set<String> changedIds = saved.getPeriods().stream()
                .filter(p -> previous.stream().noneMatch(p::equals)).map(Shift.Period::id).collect(Collectors.toSet());
        var affected = upcomingAppointments(roomId, viewingClock.instant()).stream()
                .filter(a -> a.getShiftId() == null || changedIds.contains(a.getShiftId())
                        || a.getStartAt() == null || a.getEndAt() == null).toList();
        // Never writes Appointment: all booked hours, status and holds remain intact.
        return scheduleResponse(saved, affected);
    }

    @Override
    public ViewingAvailabilityResponse viewingAvailability(String roomId, LocalDate date) {
        Instant now = viewingClock.instant();
        if (date == null || date.isBefore(LocalDate.ofInstant(now, VIEWING_ZONE))) {
            throw new BadRequestException("Ngày xem phòng không được ở quá khứ");
        }
        ViewingEligibilityResponse eligibility = publicRoomEligibility(roomId);
        expireMatching(Query.query(Criteria.where("roomId").is(MongoQueryHelper.toObjectId(roomId))
                .and("appointmentDate").is(date)));
        Shift configuration = shiftService.getForRoom(roomId);
        List<Appointment> roomAppointments = appointmentRepository
                .findByRoomIdAndAppointmentDateAndIsDeletedFalse(roomId, date);
        List<Appointment> own = ownAppointments(date);
        boolean ownRoomDay = own.stream().anyMatch(a -> roomId.equals(a.getRoomId())
                && (holds(a, now) || a.getStatus() == AppointmentStatus.COMPLETED || a.getStatus() == AppointmentStatus.NO_SHOW));
        var periods = configuration.getPeriods().stream().map(p -> {
            Instant start = date.atTime(LocalTime.parse(p.startTime())).atZone(VIEWING_ZONE).toInstant();
            Instant end = date.atTime(LocalTime.parse(p.endTime())).atZone(VIEWING_ZONE).toInstant();
            ViewingAvailabilityResponse.Reason reason;
            if (!eligibility.canReceiveRequest()) reason = ViewingAvailabilityResponse.Reason.ROOM_UNAVAILABLE;
            else if (!p.isActive()) reason = ViewingAvailabilityResponse.Reason.DISABLED;
            else if (!start.isAfter(now)) reason = ViewingAvailabilityResponse.Reason.STARTED;
            else if (roomAppointments.stream().anyMatch(a -> holds(a, now)
                    && (p.id().equals(a.getShiftId()) || p.type() == a.getShiftType() || overlapsOrUnknown(a, start, end)))) {
                reason = ViewingAvailabilityResponse.Reason.ROOM_TAKEN;
            } else if (ownRoomDay) reason = ViewingAvailabilityResponse.Reason.TENANT_ROOM_DAY;
            else if (own.stream().anyMatch(a -> holds(a, now) && p.type() == a.getShiftType())) {
                reason = ViewingAvailabilityResponse.Reason.TENANT_SAME_TYPE;
            } else if (own.stream().anyMatch(a -> holds(a, now) && overlapsOrUnknown(a, start, end))) {
                reason = ViewingAvailabilityResponse.Reason.TENANT_TIME_OVERLAP;
            } else reason = ViewingAvailabilityResponse.Reason.AVAILABLE;
            return new ViewingAvailabilityResponse.Period(p.id(), p.type(), p.startTime(), p.endTime(),
                    start, end, p.isActive(), reason == ViewingAvailabilityResponse.Reason.AVAILABLE, reason);
        }).toList();
        return new ViewingAvailabilityResponse(roomId, date, VIEWING_ZONE.getId(), now, configuration.getVersion(), eligibility, periods);
    }

    private List<Appointment> ownAppointments(LocalDate date) {
        var account = access.currentAccount();
        if (account.isEmpty()) return List.of();
        if (!account.get().active()) throw new ForbiddenException("Tài khoản hiện không hoạt động");
        if (!account.get().canRequest()) return List.of();
        List<Appointment> records = new ArrayList<>(appointmentRepository
                .findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse(account.get().accountId(), date));
        if (account.get().tenantProfileId() != null) {
            records.addAll(appointmentRepository.findByTenantIdAndAppointmentDateAndIsDeletedFalse(account.get().tenantProfileId(), date)
                    .stream().filter(a -> a.getRequesterAccountId() == null).toList());
        }
        return records;
    }

    private List<Appointment> upcomingAppointments(String roomId, Instant now) {
        return appointmentRepository.findByRoomIdAndAppointmentDateGreaterThanEqualAndIsDeletedFalse(
                        roomId, LocalDate.ofInstant(now, VIEWING_ZONE)).stream()
                .filter(a -> holds(a, now) && (a.getStartAt() == null || a.getStartAt().isAfter(now)))
                .sorted(Comparator.comparing(Appointment::getAppointmentDate)).toList();
    }

    private ShiftResponse scheduleResponse(Shift configuration, List<Appointment> appointments) {
        ViewingRoomSnapshot room = inventory.getRoom(configuration.getRoomId());
        return new ShiftResponse(configuration.getRoomId(), room.branchId(), room.roomNumber(), room.branchName(),
                configuration.getVersion(), configuration.getPeriods(), appointments.stream().map(this::existingAppointment).toList());
    }

    private ShiftResponse.ExistingAppointment existingAppointment(Appointment a) {
        return new ShiftResponse.ExistingAppointment(a.getId(), a.getAppointmentDate(), a.getShiftType(),
                a.getStartAt(), a.getEndAt(), a.getStatus().name());
    }

    private boolean holds(Appointment appointment, Instant now) {
        if (appointment.getStatus() == AppointmentStatus.CONFIRMED) return true;
        if (appointment.getStatus() != AppointmentStatus.PENDING) return false;
        Instant expiry = appointment.getExpiresAt();
        if (expiry == null && appointment.getCreatedAt() != null) expiry = appointment.getCreatedAt().plus(Duration.ofHours(24));
        if (appointment.getStartAt() != null && (expiry == null || appointment.getStartAt().isBefore(expiry))) {
            expiry = appointment.getStartAt();
        }
        return expiry == null || now.isBefore(expiry);
    }

    private boolean overlapsOrUnknown(Appointment a, Instant start, Instant end) {
        return a.getStartAt() == null || a.getEndAt() == null || (start.isBefore(a.getEndAt()) && a.getStartAt().isBefore(end));
    }

    @Override
    public ViewingContextResponse currentContext() {
        return ViewingContextResponse.from(requireActiveAccount());
    }

    @Override
    public ViewingEligibilityResponse publicRoomEligibility(String roomId) {
        ViewingRoomSnapshot room = inventory.getRoom(roomId);
        if (!room.publicListing()) throw new NotFoundException("Không tìm thấy phòng công khai");
        Reason reason;
        if (!room.branchActive()) reason = Reason.BRANCH_INACTIVE;
        else if (!room.roomOperational()) reason = Reason.ROOM_UNAVAILABLE;
        else if (room.availableUnits() > 0) reason = Reason.AVAILABLE;
        else if (room.temporarilyHeldUnits() > 0) reason = Reason.TEMPORARY_HOLD;
        else if (room.officiallyHeldUnits() > 0) reason = Reason.OFFICIAL_HOLD;
        else reason = Reason.NO_VACANCY;
        return new ViewingEligibilityResponse(room.roomId(), room.branchId(), room.roomNumber(),
                room.branchName(), room.publicContactPhone(), room.rentalMode(),
                reason == Reason.AVAILABLE, reason);
    }

    private Actor requireRequester() {
        Actor account = requireActiveAccount();
        if (!account.canRequest()) throw new ForbiddenException("Tài khoản không có quyền đặt lịch xem phòng");
        return account;
    }

    private Actor requireManager(String roomId) {
        Actor account = requireActiveAccount();
        ViewingRoomSnapshot room = inventory.getRoom(roomId);
        if (!account.canManage(room.branchId())) {
            throw new ForbiddenException("Không có quyền quản lý lịch xem của phòng này");
        }
        return account;
    }

    private Actor requireActiveAccount() {
        Actor account = access.currentAccount().orElseThrow(
                () -> new UnauthorizedException("Vui lòng đăng nhập để sử dụng lịch xem phòng"));
        if (!account.active()) throw new ForbiddenException("Tài khoản hiện không hoạt động");
        return account;
    }

    @Override
    public AppointmentResponse create(AppointmentCreateRequest request, String idempotencyKey) {
        Actor account = requireRequester();
        if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new BadRequestException("Cần mã gửi Idempotency-Key hợp lệ để tránh tạo yêu cầu trùng");
        }
        if (request == null || request.appointmentDate() == null || request.configurationVersion() == null
                || request.configurationVersion() < 0 || request.contactName() == null || request.contactPhone() == null
                || !request.appointmentDate().toString().matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new BadRequestException("Thông tin đặt lịch chưa đầy đủ hoặc ngày không đúng YYYY-MM-DD");
        }
        String roomId = MongoQueryHelper.toObjectId(request.roomId()).toHexString();
        String shiftId = MongoQueryHelper.toObjectId(request.shiftId()).toHexString();
        String contactName = request.contactName().trim();
        String phone = request.contactPhone().replaceAll("[\\s().-]", "");
        if (contactName.length() < 2 || contactName.length() > 120 || contactName.codePoints().anyMatch(Character::isISOControl)
                || !phone.matches("\\+?[0-9]{9,15}")) throw new BadRequestException("Họ tên hoặc số điện thoại liên hệ không hợp lệ");
        String fingerprint = fingerprint(String.join("\u0000", roomId, shiftId, request.appointmentDate().toString(),
                request.configurationVersion().toString(), contactName, phone));
        var replay = appointmentRepository.findByRequesterAccountIdAndIdempotencyKeyAndIsDeletedFalse(account.accountId(), idempotencyKey);
        if (replay.isPresent()) return replay(replay.get(), fingerprint);

        if (!publicRoomEligibility(roomId).canReceiveRequest()) throw new ConflictException("Phòng hiện không nhận lịch xem", "ROOM_UNAVAILABLE");
        shiftService.getForRoom(roomId); // Initialize outside the transaction, before reading a selected period.
        try {
            return appointmentRepository.withCreationGuards(account.accountId(), roomId, request.appointmentDate().toString(), () -> {
                requireRequester();
                var existing = appointmentRepository.findByRequesterAccountIdAndIdempotencyKeyAndIsDeletedFalse(account.accountId(), idempotencyKey);
                if (existing.isPresent()) return replay(existing.get(), fingerprint);
                Instant now = viewingClock.instant();
                expireMatching(Query.query(new Criteria().andOperator(Criteria.where("appointmentDate").is(request.appointmentDate()),
                        new Criteria().orOperator(Criteria.where("roomId").is(new ObjectId(roomId)), ownCriteria(account)))));
                Shift configuration = shiftService.getForRoom(roomId);
                if (!Objects.equals(configuration.getVersion(), request.configurationVersion())) {
                    throw new ConflictException("Giờ ca đã thay đổi. Hãy tải lại ca trước khi gửi.", "SHIFT_VERSION_CONFLICT");
                }
                var period = configuration.getPeriods().stream().filter(p -> p.id().equals(shiftId)).findFirst()
                        .orElseThrow(() -> new BadRequestException("Ca không thuộc phòng được chọn"));
                Instant start = request.appointmentDate().atTime(LocalTime.parse(period.startTime())).atZone(VIEWING_ZONE).toInstant();
                Instant end = request.appointmentDate().atTime(LocalTime.parse(period.endTime())).atZone(VIEWING_ZONE).toInstant();
                if (!period.isActive() || !start.isAfter(now)) throw new ConflictException("Ca đã bắt đầu hoặc đang ngừng nhận yêu cầu", "SHIFT_UNAVAILABLE");
                shiftService.lockForAppointment(roomId, configuration.getVersion());
                ViewingRoomSnapshot room = inventory.getRoom(roomId);
                if (!publicRoomEligibility(roomId).canReceiveRequest()) throw new ConflictException("Phòng không còn nhận lịch xem", "ROOM_UNAVAILABLE");
                var roomAppointments = appointmentRepository.findByRoomIdAndAppointmentDateAndIsDeletedFalse(roomId, request.appointmentDate());
                if (roomAppointments.stream().anyMatch(a -> holds(a, now) && (shiftId.equals(a.getShiftId())
                        || period.type() == a.getShiftType() || overlapsOrUnknown(a, start, end)))) {
                    throw new ConflictException("Ca này đã có lịch. Vui lòng chọn ca khác.", "ROOM_SHIFT_TAKEN");
                }
                var own = ownAppointments(request.appointmentDate());
                if (own.stream().anyMatch(a -> roomId.equals(a.getRoomId()) && (holds(a, now)
                        || a.getStatus() == AppointmentStatus.COMPLETED || a.getStatus() == AppointmentStatus.NO_SHOW))) {
                    throw new ConflictException("Bạn đã có lịch của phòng này trong ngày", "TENANT_ROOM_DAY");
                }
                if (own.stream().anyMatch(a -> holds(a, now) && (period.type() == a.getShiftType() || overlapsOrUnknown(a, start, end)))) {
                    throw new ConflictException("Trùng loại ca hoặc giờ với lịch xem khác của bạn", "TENANT_SCHEDULE_CONFLICT");
                }
                // Re-check the actual clock at the final write boundary, not only at form submission.
                Instant committedAt = viewingClock.instant();
                if (!start.isAfter(committedAt)) throw new ConflictException("Ca đã bắt đầu. Vui lòng chọn ca khác.", "SHIFT_STARTED");
                Appointment appointment = new Appointment();
                // The primary key also protects same-key requests across different day guards
                // when MongoDB automatic secondary-index creation is disabled.
                appointment.setId(fingerprint(account.accountId() + "\u0000" + idempotencyKey).substring(0, 24));
                appointment.setRequesterAccountId(account.accountId()); appointment.setTenantId(account.tenantProfileId());
                appointment.setRoomId(roomId); appointment.setBranchId(room.branchId()); appointment.setShiftId(shiftId);
                appointment.setShiftType(period.type()); appointment.setAppointmentDate(request.appointmentDate());
                appointment.setStartAt(start); appointment.setEndAt(end); appointment.setConfigurationVersion(configuration.getVersion());
                appointment.setExpiresAt(start.isBefore(committedAt.plus(Duration.ofHours(24))) ? start : committedAt.plus(Duration.ofHours(24)));
                appointment.setRoomNumber(room.roomNumber()); appointment.setBranchName(room.branchName());
                appointment.setPublicContactPhone(room.publicContactPhone()); appointment.setContactName(contactName); appointment.setContactPhone(phone);
                appointment.setIdempotencyKey(idempotencyKey); appointment.setRequestFingerprint(fingerprint);
                appointment.setCreatedAt(committedAt); appointment.setUpdatedAt(committedAt);
                String eventId = new ObjectId().toHexString();
                appointment.getHistory().add(new Appointment.HistoryEntry(eventId, "CREATED", account.accountId(), account.fullName(),
                        committedAt, null, AppointmentStatus.PENDING, "Đã gửi yêu cầu; đang chờ duyệt"));
                notificationSupport.plan(appointment, eventId, "CREATED", committedAt, account.accountId(), null).applyTo(appointment);
                return response(appointmentRepository.insert(appointment));
            });
        } catch (DuplicateKeyException duplicate) {
            var existing = appointmentRepository.findByRequesterAccountIdAndIdempotencyKeyAndIsDeletedFalse(account.accountId(), idempotencyKey);
            if (existing.isPresent()) return replay(existing.get(), fingerprint);
            throw new ConflictException("Yêu cầu đang được xử lý. Thử lại với cùng mã gửi.", "APPOINTMENT_BUSY");
        }
    }

    @Override
    public AppointmentResponse getById(String id) {
        MongoQueryHelper.toObjectId(id);
        Actor actor = requireActiveAccount();
        Appointment appointment = appointmentRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lịch hẹn"));
        if (!owns(actor, appointment) && !actor.canManage(appointment.getBranchId())) throw new ForbiddenException("Không có quyền xem lịch hẹn này");
        expireMatching(Query.query(Criteria.where("_id").is(new ObjectId(id))));
        return response(appointmentRepository.findByIdAndIsDeletedFalse(id).orElseThrow());
    }

    @Override
    public PagedResponse<AppointmentResponse> search(AppointmentFilterRequest filter, Pageable pageable) {
        Actor actor = requireActiveAccount();
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(readScope(actor));
        if (filter.fromDate() != null && filter.toDate() != null && filter.fromDate().isAfter(filter.toDate())) {
            throw new BadRequestException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        }
        if (filter.branchId() != null) conditions.add(Criteria.where("branchId").is(MongoQueryHelper.toObjectId(filter.branchId())));
        if (filter.roomId() != null) conditions.add(Criteria.where("roomId").is(MongoQueryHelper.toObjectId(filter.roomId())));
        if (filter.shiftId() != null) conditions.add(Criteria.where("shiftId").is(MongoQueryHelper.toObjectId(filter.shiftId())));
        if (filter.fromDate() != null) conditions.add(Criteria.where("appointmentDate").gte(filter.fromDate()));
        if (filter.toDate() != null) conditions.add(Criteria.where("appointmentDate").lte(filter.toDate()));
        expireMatching(Query.query(new Criteria().andOperator(conditions.toArray(Criteria[]::new))));
        if (filter.status() != null) conditions.add(Criteria.where("status").is(filter.status().name()));
        if (Boolean.TRUE.equals(filter.needsResult())) {
            if (actor.manageableBranchIds().isEmpty()) throw new ForbiddenException("Chỉ phía quản lý có bộ lọc cần cập nhật kết quả");
            conditions.add(Criteria.where("branchId").in(actor.manageableBranchIds().stream().map(MongoQueryHelper::toObjectId).toList()));
            conditions.add(Criteria.where("status").is(AppointmentStatus.CONFIRMED.name()));
            conditions.add(Criteria.where("endAt").lte(viewingClock.instant()));
        }
        var paging = PageRequest.of(pageable.getPageNumber(), Math.min(Math.max(pageable.getPageSize(), 1), 100),
                Sort.by("appointmentDate", "startAt", "id"));
        return PagedResponse.from(appointmentRepository.findWithPagination(new Criteria().andOperator(conditions.toArray(Criteria[]::new)), paging), this::response);
    }

    private AppointmentResponse replay(Appointment appointment, String fingerprint) {
        if (!fingerprint.equals(appointment.getRequestFingerprint())) {
            throw new ConflictException("Mã gửi đã được dùng cho thông tin khác. Hãy tạo lượt gửi mới.", "IDEMPOTENCY_KEY_REUSED");
        }
        expireMatching(Query.query(Criteria.where("_id").is(new ObjectId(appointment.getId()))));
        return response(appointmentRepository.findByIdAndIsDeletedFalse(appointment.getId()).orElse(appointment));
    }

    private boolean owns(Actor actor, Appointment appointment) {
        return actor.accountId().equals(appointment.getRequesterAccountId()) || (appointment.getRequesterAccountId() == null
                && actor.tenantProfileId() != null && actor.tenantProfileId().equals(appointment.getTenantId()));
    }

    private Criteria ownCriteria(Actor actor) {
        Criteria account = Criteria.where("requesterAccountId").is(actor.accountId());
        if (actor.tenantProfileId() == null) return account;
        return new Criteria().orOperator(account, new Criteria().andOperator(Criteria.where("requesterAccountId").is(null),
                Criteria.where("tenantId").is(MongoQueryHelper.toObjectId(actor.tenantProfileId()))));
    }

    private Criteria readScope(Actor actor) {
        var branches = actor.manageableBranchIds().stream().map(MongoQueryHelper::toObjectId).toList();
        return branches.isEmpty() ? ownCriteria(actor)
                : new Criteria().orOperator(ownCriteria(actor), Criteria.where("branchId").in(branches));
    }

    private void expireMatching(Query scope) {
        Instant now = viewingClock.instant();
        appointmentRepository.expireDue(scope, now, (appointment, eventId, update) -> notificationSupport
                .plan(appointment, eventId, "EXPIRED", now, null, "Hết thời hạn duyệt lịch xem phòng").appendTo(update));
    }

    public void expirePendingRequests() {
        try { expireMatching(new Query()); }
        catch (RuntimeException error) { log.warn("Could not process pending viewing request expiration", error); }
    }

    private AppointmentResponse response(Appointment a) {
        return appointmentMapper.toResponse(a, allowedActions(a));
    }

    private String fingerprint(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    @Override
    public AppointmentResponse approve(String id, AppointmentActionRequest.Approval request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), true);
        requireStatus(a, AppointmentStatus.PENDING);
        var room = inventory.getRoom(a.getRoomId());
        if (!Objects.equals(a.getBranchId(), room.branchId())) throw new ConflictException("Phạm vi phòng đã thay đổi; cần kiểm tra lại lịch", "ROOM_SCOPE_CHANGED");
        if (!publicRoomEligibility(a.getRoomId()).canReceiveRequest()) throw new ConflictException("Phòng hiện không đủ điều kiện duyệt lịch", "ROOM_UNAVAILABLE");
        Instant now = viewingClock.instant();
        requirePendingDeadline(a, now);
        return saveAction(a, actor, "APPROVED", AppointmentStatus.CONFIRMED, now, null,
                new Update().set("approvedBy", actor.accountId()).set("approvedByName", actor.fullName()).set("approvedAt", now), null, null);
    }

    @Override
    public AppointmentResponse reject(String id, AppointmentActionRequest.Rejection request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), true);
        requireStatus(a, AppointmentStatus.PENDING);
        String reason = actionText(request.reason(), true);
        Instant now = viewingClock.instant();
        requirePendingDeadline(a, now);
        return saveAction(a, actor, "REJECTED", AppointmentStatus.REJECTED, now, reason,
                new Update().set("rejectReason", reason), null, null);
    }

    @Override
    public AppointmentResponse cancel(String id, AppointmentActionRequest.Cancellation request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), false);
        boolean manager = actor.canManage(a.getBranchId());
        if (a.getStatus() != AppointmentStatus.PENDING && a.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new ConflictException("Lịch đã kết thúc, không được hủy", "INVALID_APPOINTMENT_STATE");
        }
        Instant now = viewingClock.instant();
        if (a.getStatus() == AppointmentStatus.PENDING) requirePendingDeadline(a, now);
        String reason = actionText(request.reason(), manager);
        CancellationCause cause = CancellationCause.TENANT_REQUEST;
        if (manager) {
            if (request.cause() == null) throw new BadRequestException("Cần chọn bên yêu cầu/nguyên nhân hủy");
            if (request.cause() != CancellationCause.TENANT_REQUEST && request.cause() != CancellationCause.LANDLORD_UNAVAILABLE) {
                throw new BadRequestException("Nguyên nhân hủy tự động chỉ do hệ thống ghi nhận");
            }
            cause = request.cause();
            if (!Boolean.TRUE.equals(request.viewingDidNotOccur())) throw new BadRequestException("Chỉ hủy nếu buổi xem chưa thực tế diễn ra");
            if (cause == CancellationCause.TENANT_REQUEST) {
                if (!Boolean.TRUE.equals(request.tenantRequestConfirmed())) throw new BadRequestException("Cần xác nhận đúng yêu cầu hủy của người xem");
                if (a.getStartAt() == null || !now.isBefore(a.getStartAt())) {
                    throw new ConflictException("Ca đã bắt đầu; chỉ hủy muộn khi phía cho thuê không thể tiếp khách", "CANCELLATION_TOO_LATE");
                }
            } else if (request.tenantRequestConfirmed() != null) throw new BadRequestException("Xác nhận yêu cầu Tenant chỉ dùng khi hủy theo yêu cầu Tenant");
        } else {
            if (request.cause() != null || request.tenantRequestConfirmed() != null || request.viewingDidNotOccur() != null) {
                throw new BadRequestException("Người đặt chỉ gửi ghi chú hủy tùy chọn");
            }
            if (!canSelfCancel(a, now)) throw new ConflictException("Đã qua hạn tự hủy. Vui lòng liên hệ phía quản lý", "CANCELLATION_TOO_LATE");
        }
        return saveAction(a, actor, "CANCELLED", AppointmentStatus.CANCELLED, now, reason,
                new Update().set("cancellationReason", reason).set("cancellationCause", cause), null, cause);
    }

    @Override
    public AppointmentResponse complete(String id, AppointmentActionRequest.Completion request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), true);
        requireStatus(a, AppointmentStatus.CONFIRMED);
        Instant now = viewingClock.instant();
        requireOutcome(a, AppointmentStatus.COMPLETED, request.viewingFinished(), null, null, now);
        String note = actionText(request.note(), false);
        return saveAction(a, actor, "COMPLETED", AppointmentStatus.COMPLETED, now, null, new Update().set("result", note), note, null);
    }

    @Override
    public AppointmentResponse noShow(String id, AppointmentActionRequest.NoShow request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), true);
        requireStatus(a, AppointmentStatus.CONFIRMED);
        Instant now = viewingClock.instant();
        requireOutcome(a, AppointmentStatus.NO_SHOW, null, request.tenantAbsent(), request.landlordAvailable(), now);
        String note = actionText(request.note(), false);
        return saveAction(a, actor, "NO_SHOW", AppointmentStatus.NO_SHOW, now, null, new Update().set("result", note), note, null);
    }

    @Override
    public AppointmentResponse correctResult(String id, AppointmentActionRequest.Correction request) {
        var actor = requireActiveAccount();
        var a = actionTarget(id, actor, request.version(), true);
        if (a.getStatus() != AppointmentStatus.COMPLETED && a.getStatus() != AppointmentStatus.NO_SHOW) {
            throw new ConflictException("Chỉ sửa kết quả đã ghi nhận COMPLETED/NO_SHOW", "INVALID_APPOINTMENT_STATE");
        }
        if (request.outcome() == null) throw new BadRequestException("Cần chọn kết quả");
        var outcome = AppointmentStatus.valueOf(request.outcome().name());
        Instant now = viewingClock.instant();
        requireOutcome(a, outcome, request.viewingFinished(), request.tenantAbsent(), request.landlordAvailable(), now);
        String reason = actionText(request.reason(), true);
        String note = actionText(request.note(), false);
        if (a.getStatus() == outcome && Objects.equals(a.getResult(), note)) throw new BadRequestException("Kết quả và ghi chú chưa thay đổi");
        return saveAction(a, actor, "RESULT_CORRECTED", outcome, now, reason, new Update().set("result", note), note, null);
    }

    private Appointment actionTarget(String id, Actor actor, Long version, boolean managerOnly) {
        MongoQueryHelper.toObjectId(id);
        var a = appointmentRepository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy lịch hẹn"));
        if (!actor.canManage(a.getBranchId()) && (managerOnly || !actor.canRequest() || !owns(actor, a))) throw new ForbiddenException("Không có quyền xử lý lịch này");
        expireMatching(Query.query(Criteria.where("_id").is(new ObjectId(id))));
        a = appointmentRepository.findByIdAndIsDeletedFalse(id).orElseThrow();
        if (version == null || version < 0) throw new BadRequestException("Cần phiên bản lịch hợp lệ");
        if (version != a.getActionVersion()) throw new ConflictException("Lịch vừa được xử lý. Hãy tải lại trước khi thao tác", "APPOINTMENT_VERSION_CONFLICT");
        return a;
    }

    private void requireStatus(Appointment a, AppointmentStatus status) {
        if (a.getStatus() != status) throw new ConflictException("Trạng thái lịch không cho phép thao tác này", "INVALID_APPOINTMENT_STATE");
    }

    private void requirePendingDeadline(Appointment a, Instant now) {
        if (a.getExpiresAt() == null || !now.isBefore(a.getExpiresAt()) || a.getStartAt() == null || !now.isBefore(a.getStartAt())) {
            expireMatching(Query.query(Criteria.where("_id").is(new ObjectId(a.getId()))));
            throw new ConflictException("Yêu cầu đã hết hạn xử lý", "APPOINTMENT_EXPIRED");
        }
    }

    private boolean canSelfCancel(Appointment a, Instant now) {
        if (a.getStartAt() == null) return false;
        return a.getStatus() == AppointmentStatus.PENDING && a.getStartAt().isAfter(now)
                && a.getExpiresAt() != null && a.getExpiresAt().isAfter(now)
                || a.getStatus() == AppointmentStatus.CONFIRMED && !now.isAfter(a.getStartAt().minus(Duration.ofHours(2)));
    }

    private void requireOutcome(Appointment a, AppointmentStatus outcome, Boolean finished, Boolean absent, Boolean available, Instant now) {
        if (outcome == AppointmentStatus.COMPLETED) {
            if (!Boolean.TRUE.equals(finished) || absent != null || available != null) throw new BadRequestException("Cần xác nhận người xem đã đến và buổi xem thực tế kết thúc");
            if (a.getStartAt() == null || now.isBefore(a.getStartAt())) throw new ConflictException("Chưa đến giờ bắt đầu ca", "VIEWING_NOT_STARTED");
        } else {
            if (!Boolean.TRUE.equals(absent) || !Boolean.TRUE.equals(available) || finished != null) throw new BadRequestException("Cần xác nhận người xem không đến và phía cho thuê vẫn có thể tiếp khách");
            if (a.getEndAt() == null || now.isBefore(a.getEndAt())) throw new ConflictException("Chỉ ghi không đến từ thời điểm kết thúc ca", "VIEWING_NOT_ENDED");
        }
    }

    private String actionText(String value, boolean required) {
        String text = value == null ? null : value.trim();
        if (text != null && (text.length() > 500 || text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t'))) {
            throw new BadRequestException("Nội dung tối đa 500 ký tự và không chứa ký tự điều khiển");
        }
        if (text == null || text.isEmpty()) {
            if (required) throw new BadRequestException("Bắt buộc nhập lý do");
            return null;
        }
        return text;
    }

    private List<String> allowedActions(Appointment a) {
        var actor = requireActiveAccount();
        Instant now = viewingClock.instant();
        List<String> actions = new ArrayList<>();
        if (actor.canManage(a.getBranchId())) {
            if (a.getStatus() == AppointmentStatus.PENDING && canSelfCancel(a, now)) actions.addAll(List.of("APPROVE", "REJECT", "CANCEL"));
            if (a.getStatus() == AppointmentStatus.CONFIRMED) {
                actions.add("CANCEL");
                if (a.getStartAt() != null && !now.isBefore(a.getStartAt())) actions.add("COMPLETE");
                if (a.getEndAt() != null && !now.isBefore(a.getEndAt())) actions.add("NO_SHOW");
            }
            if (a.getStatus() == AppointmentStatus.COMPLETED || a.getStatus() == AppointmentStatus.NO_SHOW) actions.add("CORRECT_RESULT");
        } else if (actor.canRequest() && owns(actor, a) && canSelfCancel(a, now)) actions.add("CANCEL");
        return actions;
    }

    private AppointmentResponse saveAction(Appointment a, Actor actor, String action, AppointmentStatus next,
                                           Instant at, String reason, Update update, String note, CancellationCause cause) {
        String eventId = new ObjectId().toHexString();
        var history = new Appointment.HistoryEntry(eventId, action, actor.accountId(), actor.fullName(), at,
                a.getStatus(), next, reason, a.getResult(), note, cause);
        update.set("status", next).push("history", history);
        String kind = action.equals("CANCELLED") && !actor.canManage(a.getBranchId()) ? "TENANT_CANCELLED" : action;
        notificationSupport.plan(a, eventId, kind, at, actor.accountId(), reason).appendTo(update);
        // State, audit and notification intents are one conditional document write.
        Instant writeAt = viewingClock.instant();
        if (a.getStatus() == AppointmentStatus.PENDING) requirePendingDeadline(a, writeAt);
        if (action.equals("CANCELLED")) {
            if (!actor.canManage(a.getBranchId()) && !canSelfCancel(a, writeAt)) {
                throw new ConflictException("Đã qua hạn tự hủy. Vui lòng liên hệ phía quản lý", "CANCELLATION_TOO_LATE");
            }
            if (actor.canManage(a.getBranchId()) && cause == CancellationCause.TENANT_REQUEST
                    && (a.getStartAt() == null || !writeAt.isBefore(a.getStartAt()))) {
                throw new ConflictException("Ca đã bắt đầu; cần ghi nhận đúng thực tế buổi xem", "CANCELLATION_TOO_LATE");
            }
        }
        Instant selfCancellationDeadline = action.equals("CANCELLED") && !actor.canManage(a.getBranchId())
                && a.getStatus() == AppointmentStatus.CONFIRMED ? a.getStartAt().minus(Duration.ofHours(2)) : null;
        var saved = appointmentRepository.applyAction(a.getId(), a.getStatus(), a.getActionVersion(), writeAt, selfCancellationDeadline, update);
        if (saved == null) {
            expireMatching(Query.query(Criteria.where("_id").is(new ObjectId(a.getId()))));
            throw new ConflictException("Lịch đã thay đổi hoặc hết hạn. Hãy tải lại để kiểm tra", "APPOINTMENT_VERSION_CONFLICT");
        }
        return response(saved);
    }

    @Override
    public PagedResponse<NotificationResponse> notifications(Boolean read, Pageable pageable) {
        return notificationService.list(notificationScope(), read, pageable);
    }

    @Override
    public NotificationResponse readNotification(String id) {
        return notificationService.markRead(notificationScope(), id, viewingClock.instant());
    }

    @Override
    public long readAllNotifications() {
        return notificationService.markAllRead(notificationScope(), viewingClock.instant());
    }

    private NotificationScope notificationScope() {
        var actor = requireActiveAccount();
        return new NotificationScope(actor.accountId(), actor.manageableBranchIds());
    }
}
