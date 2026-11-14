package com.kitolam.rentalroommanagement.modules.booking.service.impl;

import com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.booking.document.BookingTimelineEntry;
import com.kitolam.rentalroommanagement.modules.booking.document.SelectedServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingReviewRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingTermsRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.PaymentReconciliationRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingPaymentResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.EffectiveRoomHoldResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.RoomAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import com.kitolam.rentalroommanagement.modules.booking.event.BookingStatusChangedEvent;
import com.kitolam.rentalroommanagement.modules.booking.repository.BookingRepository;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractTemplateService;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.service.support.RoomSlotAvailabilityRoller;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private static final LocalDate OPEN_ENDED_SEARCH = LocalDate.of(9999, 12, 31);

    private final BookingRepository bookingRepository;
    private final ContractRepository contractRepository;
    private final ContractService contractService;
    private final ContractTemplateService contractTemplates;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository roomSlotOccupancyRepository;
    private final com.kitolam.rentalroommanagement.modules.slotservice.repository.SlotServiceRepository slotServiceRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final PaymentRepository paymentRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;
    private final BranchService branchAccess;
    private final com.kitolam.rentalroommanagement.modules.branch.support.BranchManagerResolver branchManagers;

    @Scheduled(fixedDelayString = "${booking.automation.delay-ms:30000}", initialDelayString = "${booking.automation.initial-delay-ms:10000}")
    @Transactional
    public void expireBookingsOnSchedule() {
        expireOverdueBookings();
    }

    @Override
    public EffectiveRoomHoldResponse currentRoomHold(String roomSlotId) {
        var active = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("isDeleted").is(false),
                Criteria.where("status").in(List.of(BookingStatus.AWAITING_PAYMENT.name(), BookingStatus.CONFIRMED.name(), BookingStatus.CONVERTED.name())),
                new Criteria().orOperator(Criteria.where("roomSlotId").is(roomSlotId), Criteria.where("roomSlotIds").is(roomSlotId)))), Booking.class);
        var official = active.stream().filter(b -> (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.CONVERTED)
                && b.getDepositStatus() == DepositStatus.PAID).map(b -> b.getId()).toList();
        var now = clock.instant();
        boolean temporary = active.stream().anyMatch(b -> b.getStatus() == BookingStatus.AWAITING_PAYMENT
                && b.getHoldExpiresAt() != null && b.getHoldExpiresAt().isAfter(now)
                && b.getPaymentDeadline() != null && b.getPaymentDeadline().isAfter(now));
        String revision = active.stream().map(b -> b.getId() + ":" + b.getStatus() + ":" + b.getUpdatedAt()).sorted().collect(Collectors.joining("|"));
        return new EffectiveRoomHoldResponse(official, temporary, revision);
    }

    @Override
    @Transactional
    public BookingResponse create(BookingCreateRequest request, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        expireOverdueBookings();
        Tenant tenant = tenant(principal);
        List<String> slotIds = request.roomSlotIds() == null ? List.of() : request.roomSlotIds().stream().distinct().toList();
        if (slotIds.isEmpty() || slotIds.size() != request.roomSlotIds().size())
            throw new BadRequestException("Cần chọn các slot khác nhau để đặt");
        List<RoomSlot> slots = slotIds.stream().map(this::claimSlot).toList();
        String roomId = slots.getFirst().getRoomId();
        if (slots.stream().anyMatch(slot -> !roomId.equals(slot.getRoomId())))
            throw new BadRequestException("Các slot cần thuộc cùng một phòng");
        Room targetRoom = room(roomId);
        ensureTenantActiveAtBranch(tenant, targetRoom.getBranchId());
        if (tenant.getBranchIds() == null || !tenant.getBranchIds().contains(targetRoom.getBranchId())) {
            tenant.addBranch(targetRoom.getBranchId());
            tenantRepository.save(tenant);
        }
        LocalDate todayVietnam = todayVietnam();
        var occupancies = blockingOccupancies(slotIds);
        Map<String, LocalDate> slotMoveInDates = new LinkedHashMap<>();
        for (RoomSlot slot : slots) {
            var availability = slotAvailability(slot, todayVietnam, OPEN_ENDED_SEARCH,
                    todayVietnam, occupancies.getOrDefault(slot.getId(), List.of()));
            if (!availability.available()) throw new ConflictException(availability.reason());
            ensureNoOccupancyOverlap(slot.getId(), availability.availableFrom(), null, null);
            slotMoveInDates.put(slot.getId(), availability.availableFrom());
        }
        if (request.slotMoveInDates() != null && !request.slotMoveInDates().equals(slotMoveInDates))
            throw new ConflictException("Ngày nhận phòng đã thay đổi. Vui lòng tải lại để xác nhận ngày mới.");
        LocalDate availableFrom = slotMoveInDates.values().stream().max(LocalDate::compareTo).orElseThrow();
        // One shared payment: deposit of every slot (room deposit split per slot).
        BigDecimal deposit = slots.stream().map(slot -> {
            BigDecimal perSlot = com.kitolam.rentalroommanagement.modules.room.support.SlotPricing.deposit(room(slot.getRoomId()));
            if (perSlot == null) throw new BadRequestException("Phòng chưa cấu hình tiền cọc");
            return perSlot;
        }).reduce(BigDecimal.ZERO, BigDecimal::add);

        Booking booking = new Booking();
        booking.setTenantId(tenant.getId());
        booking.setRoomSlotId(slots.getFirst().getId());
        booking.setRoomSlotIds(slotIds);
        booking.setExpectedMoveInDate(availableFrom);
        booking.setSlotMoveInDates(slotMoveInDates);
        booking.setHoldingDepositAmount(deposit);
        Instant deadline = clock.instant().plusSeconds(24 * 60 * 60);
        booking.setPaymentDeadline(deadline);
        booking.setHoldExpiresAt(deadline);
        booking.setSelectedServices(selectedServices(request.selectedServices(), room(roomId).getBranchId()));
        booking.setStatus(BookingStatus.AWAITING_PAYMENT);
        booking.setDepositStatus(DepositStatus.UNPAID);
        Booking saved = saveTransition(booking, null, "Đã giữ các slot trong 24 giờ; đang chờ thanh toán cọc.");
        reservations(saved).forEach(roomSlotOccupancyRepository::save);
        return response(saved);
    }

    @Override
    @Transactional
    public RoomAvailabilityResponse checkAvailability(String roomSlotId, LocalDate startDate, LocalDate endDate) {
        return checkAvailability(List.of(roomSlotId), startDate, endDate).getFirst();
    }

    @Override
    @Transactional
    public List<RoomAvailabilityResponse> checkAvailability(List<String> roomSlotIds, LocalDate startDate, LocalDate endDate) {
        expireOverdueBookings();
        validateRange(startDate, endDate);
        List<String> ids = roomSlotIds == null ? List.of() : roomSlotIds.stream().distinct().toList();
        if (ids.isEmpty()) return List.of();
        if (ids.stream().anyMatch(id -> id == null || !ObjectId.isValid(id)))
            throw new BadRequestException("Danh sách RoomSlotId không hợp lệ");

        Map<String, RoomSlot> slots = roomSlotRepository.findByIdInAndIsDeletedFalse(ids).stream()
                .collect(Collectors.toMap(RoomSlot::getId, slot -> slot));
        if (slots.size() != ids.size()) throw new NotFoundException("Không tìm thấy một hoặc nhiều slot");

        var occupancies = blockingOccupancies(ids);
        LocalDate today = todayVietnam();
        return ids.stream().map(id -> slotAvailability(slots.get(id), startDate, endDate, today,
                occupancies.getOrDefault(id, List.of()))).toList();
    }

    private Map<String, List<RoomSlotOccupancy>> blockingOccupancies(Collection<String> ids) {
        return roomSlotOccupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(
                ids, List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE))
                .stream().collect(Collectors.groupingBy(RoomSlotOccupancy::getRoomSlotId));
    }

    private RoomAvailabilityResponse slotAvailability(RoomSlot slot, LocalDate start, LocalDate end, LocalDate today,
                                                       List<RoomSlotOccupancy> occupancies) {
        if (slot.isDepositPaused())
            return new RoomAvailabilityResponse(slot.getId(), slot.getSlotCode(), start, end, false,
                    "Chỗ này đang tạm ngưng đặt cọc.", null);
        if (slot.getStatus() == RoomSlotStatus.MAINTENANCE || slot.getStatus() == RoomSlotStatus.INACTIVE)
            return new RoomAvailabilityResponse(slot.getId(), slot.getSlotCode(), start, end, false,
                    "Chỗ hiện không nhận đặt.", null);
        LocalDate availableFrom = RoomSlotAvailabilityRoller.rollOverdueIntoFuture(slot.getAvailableFrom(), today);
        String reason = null;
        for (RoomSlotOccupancy occupancy : occupancies) {
            LocalDate occupiedUntil = occupancy.getEndDate();
            if (occupiedUntil != null && occupiedUntil.isBefore(today)) continue;
            if (occupancy.getStatus() == OccupancyStatus.RESERVED || occupiedUntil == null) {
                return new RoomAvailabilityResponse(slot.getId(), slot.getSlotCode(), start, end, false,
                        "Chỗ đang được giữ hoặc chưa xác định ngày trống.", null);
            }
            LocalDate freeFrom = occupiedUntil.plusDays(1);
            if (availableFrom == null || freeFrom.isAfter(availableFrom)) availableFrom = freeFrom;
            if (!RoomSlotAvailabilityRoller.releasesBefore(occupiedUntil, today))
                reason = "Chỗ chưa mở đặt cọc cho kỳ thuê tiếp theo.";
        }
        if (slot.getStatus() == RoomSlotStatus.OCCUPIED && occupancies.isEmpty())
            return new RoomAvailabilityResponse(slot.getId(), slot.getSlotCode(), start, end, false,
                    "Chưa có thông tin ngày nhận phòng.", null);
        if (availableFrom == null) reason = "Chưa có thông tin ngày nhận phòng.";
        else if (!availableFrom.isBefore(end)
                || (!end.equals(OPEN_ENDED_SEARCH) && start.isBefore(availableFrom)))
            reason = "Khoảng thuê yêu cầu bắt đầu trước khi chỗ trống hoặc không còn ngày thuê phù hợp.";
        return new RoomAvailabilityResponse(slot.getId(), slot.getSlotCode(), start, end, reason == null,
                reason, availableFrom);
    }

    private LocalDate todayVietnam() {
        return RoomSlotAvailabilityRoller.todayVietnam(clock);
    }

    @Override
    @Transactional
    public BookingResponse getById(String id, AuthPrincipal principal) {
        expireOverdueBookings();
        Booking booking = find(id);
        ensureCanView(booking, principal);
        return response(booking);
    }

    @Override
    @Transactional
    public PagedResponse<BookingResponse> search(BookingFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        expireOverdueBookings();
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").exists(true), Criteria.where("roomSlotIds").exists(true)));
        if (isRole(principal, "TENANT")) {
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", tenant(principal).getId());
        } else if (isRole(principal, "MANAGER")) {
            String branchId = managerBranch(principal);
            criteria.add(bookingSlotsInBranches(List.of(branchId)));
        } else {
            requireRole(principal, "OWNER", "ADMIN");
            if (isRole(principal, "OWNER")) {
                var branches = branchAccess.ownedBranchIds(principal.userId());
                criteria.add(bookingSlotsInBranches(branches));
            }
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
        }
        if (filter.roomSlotId() != null) criteria.add(new Criteria().orOperator(
                Criteria.where("roomSlotId").is(MongoQueryHelper.toObjectId(filter.roomSlotId())),
                Criteria.where("roomSlotIds").is(MongoQueryHelper.toObjectId(filter.roomSlotId()))));
        if (filter.roomId() != null) {
            List<ObjectId> roomSlotIds = roomSlotRepository.findByRoomIdIn(List.of(filter.roomId())).stream()
                    .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            criteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").in(roomSlotIds), Criteria.where("roomSlotIds").in(roomSlotIds)));
        }
        if (filter.from() != null && filter.to() != null && filter.to().isBefore(filter.from()))
            throw new BadRequestException("Ngày kết thúc lọc phải bằng hoặc sau ngày bắt đầu lọc");
        if (filter.from() != null) criteria.add(Criteria.where("expectedMoveOutDate").gt(filter.from()));
        if (filter.to() != null) criteria.add(Criteria.where("expectedMoveInDate").lte(filter.to()));
        if (filter.q() != null && !filter.q().isBlank()) {
            Pattern keyword = Pattern.compile(Pattern.quote(filter.q().trim()), Pattern.CASE_INSENSITIVE);
            List<String> matchingRoomIds = mongoTemplate.find(
                    Query.query(Criteria.where("roomNumber").regex(keyword)), Room.class).stream()
                    .map(Room::getId).toList();
            List<ObjectId> matchingRoomSlotIds = roomSlotRepository.findByRoomIdIn(matchingRoomIds).stream()
                    .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            List<ObjectId> matchingSlotCodes = mongoTemplate.find(
                    Query.query(Criteria.where("slotCode").regex(keyword)), RoomSlot.class).stream()
                    .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            List<ObjectId> matchingTenantIds = mongoTemplate.find(Query.query(new Criteria().orOperator(
                    Criteria.where("fullName").regex(keyword), Criteria.where("email").regex(keyword),
                    Criteria.where("phone").regex(keyword))), Tenant.class).stream()
                    .map(Tenant::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            List<Criteria> keywordCriteria = new ArrayList<>();
            if (!matchingRoomSlotIds.isEmpty()) keywordCriteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").in(matchingRoomSlotIds), Criteria.where("roomSlotIds").in(matchingRoomSlotIds)));
            if (!matchingSlotCodes.isEmpty()) keywordCriteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").in(matchingSlotCodes), Criteria.where("roomSlotIds").in(matchingSlotCodes)));
            if (!matchingTenantIds.isEmpty()) keywordCriteria.add(Criteria.where("tenantId").in(matchingTenantIds));
            if (keywordCriteria.isEmpty()) criteria.add(Criteria.where("_id").exists(false));
            else criteria.add(new Criteria().orOperator(keywordCriteria.toArray(Criteria[]::new)));
        }
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addEquals(criteria, "depositStatus", filter.depositStatus());
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, Booking.class), this::response);
    }

    private Criteria bookingSlotsInBranches(Collection<String> branchIds) {
        List<String> roomIds = roomRepository.findByBranchIdIn(branchIds).stream().map(Room::getId).toList();
        List<ObjectId> slotIds = roomSlotRepository.findByRoomIdIn(roomIds).stream()
                .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
        return new Criteria().orOperator(Criteria.where("roomSlotId").in(slotIds), Criteria.where("roomSlotIds").in(slotIds));
    }

    @Override
    @Transactional
    public BookingResponse review(String id, BookingReviewRequest request, AuthPrincipal principal) {
        requireRole(principal, "OWNER", "MANAGER", "ADMIN");
        expireOverdueBookings();
        Booking booking = find(id);
        ensureCanManage(booking, principal);
        BookingStatus previous = booking.getStatus();
        boolean editableTerms = previous == BookingStatus.AWAITING_PAYMENT && booking.getTermsAcceptedAt() == null
                && paymentRepository.findByBookingIdAndIsDeletedFalse(id).stream()
                .noneMatch(p -> p.getStatus() == PaymentStatus.SUCCESS);
        if (previous != BookingStatus.REQUESTED && !editableTerms)
            throw new ConflictException("Chỉ yêu cầu mới hoặc chưa được Tenant chấp nhận điều khoản mới được xử lý");

        if (!request.accepted()) {
            if (request.rejectReason() == null || request.rejectReason().isBlank())
                throw new BadRequestException("Cần nhập lý do từ chối");
            booking.setRejectReason(request.rejectReason().trim());
            booking.setStatus(BookingStatus.REJECTED);
            claimBookingSlots(booking);
            Booking saved = saveTransition(booking, previous, "Owner từ chối yêu cầu.");
            releaseReservation(saved.getId());
            return response(saved);
        }

        LocalDate start = request.expectedMoveInDate() == null ? booking.getExpectedMoveInDate() : request.expectedMoveInDate();
        if (booking.getSlotMoveInDates() != null && !Objects.equals(start, booking.getExpectedMoveInDate()))
            throw new BadRequestException("Không thể đổi ngày bắt đầu thuê đã chốt cho các slot.");
        LocalDate end = request.expectedMoveOutDate() == null ? booking.getExpectedMoveOutDate() : request.expectedMoveOutDate();
        validateRange(start, end);
        BigDecimal amount = request.holdingDepositAmount();
        if (amount == null || amount.signum() < 0)
            throw new BadRequestException("Cần xác nhận số tiền cọc giữ chỗ hợp lệ");
        Instant now = clock.instant();
        if (request.paymentDeadline() == null || !request.paymentDeadline().isAfter(now)
                || request.holdExpiresAt() == null || !request.holdExpiresAt().isAfter(now))
            throw new BadRequestException("Hạn thanh toán và thời điểm hết hạn giữ chỗ phải ở tương lai");
        if (request.cancellationPolicy() == null || request.cancellationPolicy().isBlank())
            throw new BadRequestException("Cần xác nhận điều kiện hủy");
        if (request.checkInDeadline() == null || !request.checkInDeadline().isAfter(now)
                || request.checkInDeadline().isBefore(start.atStartOfDay(java.time.ZoneOffset.UTC).toInstant()))
            throw new BadRequestException("Hạn check-in phải ở tương lai và không trước ngày bắt đầu thuê");
        claimBookingSlots(booking);
        for (String slotId : bookingSlotIds(booking)) ensureNoOccupancyOverlap(slotId, booking.getSlotMoveInDates() == null
                ? start : booking.getSlotMoveInDates().get(slotId), end, booking.getId());

        booking.setExpectedMoveInDate(start);
        booking.setExpectedMoveOutDate(end);
        booking.setHoldingDepositAmount(amount);
        booking.setPaymentDeadline(request.paymentDeadline());
        booking.setHoldExpiresAt(request.holdExpiresAt());
        booking.setCheckInDeadline(request.checkInDeadline());
        booking.setCancellationPolicy(request.cancellationPolicy().trim());
        booking.setRejectReason(null);
        booking.setStatus(BookingStatus.AWAITING_PAYMENT);
        booking.setDepositStatus(DepositStatus.UNPAID);
        updateReservationRange(booking, start, end);
        return response(saveTransition(booking, previous, previous == BookingStatus.REQUESTED
                ? "Owner duyệt yêu cầu và gửi điều khoản giữ chỗ."
                : "Owner cập nhật và gửi lại điều khoản giữ chỗ."));
    }

    @Override
    @Transactional
    public BookingResponse acceptTerms(String id, BookingTermsRequest request, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        expireOverdueBookings();
        Booking booking = find(id);
        ensureTenantOwns(booking, principal);
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT)
            throw new ConflictException("Yêu cầu chưa có điều khoản chờ xác nhận");
        if (!request.accepted()) {
            booking.setStatus(BookingStatus.CANCELLED);
            claimBookingSlots(booking);
            Booking saved = saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Tenant không chấp nhận điều khoản.");
            releaseReservation(saved.getId());
            return response(saved);
        }
        ensureTermsCurrent(booking);
        requireReservation(booking.getId());
        booking.setTermsAcceptedAt(clock.instant());
        return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Tenant đã chấp nhận điều khoản giữ chỗ."));
    }

    @Override
    @Transactional
    public BookingResponse cancel(String id, AuthPrincipal principal) {
        requireRole(principal, "TENANT", "MANAGER", "OWNER", "ADMIN");
        expireOverdueBookings();
        Booking booking = find(id);
        if (isRole(principal, "TENANT")) ensureTenantOwns(booking, principal);
        else ensureCanManage(booking, principal);
        claimBookingSlots(booking);
        boolean manager = !isRole(principal, "TENANT");
        boolean confirmedBeforeHandover = manager && booking.getStatus() == BookingStatus.CONFIRMED;
        if (confirmedBeforeHandover && contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                .anyMatch(contract -> contract.getStatus() == ContractStatus.ACTIVE))
            throw new ConflictException("Booking đã có hợp đồng được duyệt, không thể hủy");
        if (booking.getStatus() != BookingStatus.REQUESTED && booking.getStatus() != BookingStatus.AWAITING_PAYMENT && !confirmedBeforeHandover)
            throw new ConflictException("Trạng thái hiện tại không cho phép hủy yêu cầu");
        if (!confirmedBeforeHandover && paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS))
            throw new ConflictException("Đã nhận thanh toán; vui lòng liên hệ Owner để xử lý hoàn tiền");
        if (confirmedBeforeHandover) {
            contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                    .filter(contract -> contract.getStatus() == ContractStatus.DRAFT)
                    .forEach(draft -> {
                        draft.setStatus(ContractStatus.TERMINATED);
                        draft.setTerminatedAt(clock.instant());
                        draft.setTerminationReason("Owner/Manager không thể bàn giao phòng.");
                        contractRepository.save(draft);
                    });
        }
        BookingStatus previous = booking.getStatus();
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setTermsAcceptedAt(null);
        Booking saved = saveTransition(booking, previous, confirmedBeforeHandover
                ? "Owner/Manager hủy booking đã xác nhận do không thể bàn giao; khoản cọc chờ xử lý theo chính sách hủy."
                : "Tenant đã hủy yêu cầu.");
        releaseReservation(saved.getId());
        if (confirmedBeforeHandover) refreshRoomStatus(room(roomSlot(saved.getRoomSlotId()).getRoomId()));
        return response(saved);
    }

    @Override
    @Transactional
    public BookingPaymentResponse createBankTransfer(String id, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        expireOverdueBookings();
        Booking booking = find(id);
        ensureTenantOwns(booking, principal);
        validatePaymentAllowed(booking);
        Payment pending = paymentRepository.findByBookingIdAndIsDeletedFalse(id).stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING).findFirst().orElse(null);
        if (pending != null) return paymentResponse(pending, null);
        Payment payment = new Payment();
        payment.setBookingId(id);
        payment.setAmount(booking.getHoldingDepositAmount());
        payment.setMethod(PaymentMethod.BANK_TRANSFER);
        payment.setTransactionCode("BOOKING-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        payment.setStatus(PaymentStatus.PENDING);
        return paymentResponse(paymentRepository.save(payment), null);
    }

    @Override
    @Transactional
    public BookingPaymentResponse createVnPayPayment(String id, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        expireOverdueBookings();
        Booking booking = find(id);
        ensureTenantOwns(booking, principal);
        validatePaymentAllowed(booking);
        Payment pending = paymentRepository.findByBookingIdAndIsDeletedFalse(id).stream()
                .filter(p -> p.getMethod() == PaymentMethod.VNPAY && p.getStatus() == PaymentStatus.PENDING)
                .findFirst().orElse(null);
        if (pending != null) return paymentResponse(pending, null);
        Payment payment = new Payment();
        payment.setBookingId(id);
        payment.setAmount(booking.getHoldingDepositAmount());
        payment.setMethod(PaymentMethod.VNPAY);
        payment.setTransactionCode("BOOKING-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        payment.setStatus(PaymentStatus.PENDING);
        return paymentResponse(paymentRepository.save(payment), null);
    }

    @Override
    public void validateBookingDeposit(String id, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        Booking booking = find(id);
        ensureTenantOwns(booking, principal);
        validatePaymentAllowed(booking);
    }

    @Override
    @Transactional
    public List<BookingPaymentResponse> payments(String id, AuthPrincipal principal) {
        expireOverdueBookings();
        Booking booking = find(id);
        ensureCanView(booking, principal);
        return paymentRepository.findByBookingIdAndIsDeletedFalse(id).stream().map(p -> paymentResponse(p, null)).toList();
    }

    @Override
    @Transactional
    public BookingResponse reconcilePayment(String id, String paymentId, PaymentReconciliationRequest request, AuthPrincipal principal) {
        requireRole(principal, "OWNER", "MANAGER", "ADMIN");
        Booking booking = find(id);
        ensureCanManage(booking, principal);
        Payment payment = paymentRepository.findByIdAndBookingIdAndIsDeletedFalse(paymentId, id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy giao dịch của booking"));
        if (payment.getMethod() != PaymentMethod.BANK_TRANSFER || payment.getStatus() != PaymentStatus.PENDING)
            throw new ConflictException("Giao dịch không ở trạng thái chờ đối soát");
        payment.setStatus(request.successful() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
        if (request.successful()) payment.setPaidAt(clock.instant());
        paymentRepository.save(payment);
        return processPaymentResult(id, request.successful());
    }

    @Override
    @Transactional
    public BookingResponse processPaymentResult(String id, boolean successful) {
        Booking booking = find(id);
        if (booking.getStatus() == BookingStatus.CONFIRMED)
            return response(booking);
        if (booking.getStatus() == BookingStatus.EXPIRED && !successful) return response(booking);
        if (booking.getStatus() == BookingStatus.EXPIRED && successful)
            return processLatePayment(booking);
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT)
            throw new ConflictException("Booking không chờ kết quả thanh toán");
        boolean holdValid = booking.getPaymentDeadline() != null && clock.instant().isBefore(booking.getPaymentDeadline())
                && booking.getHoldExpiresAt() != null && clock.instant().isBefore(booking.getHoldExpiresAt());
        if (!successful) {
            if (!holdValid) {
                claimBookingSlots(booking);
                expireBooking(booking);
                Booking saved = saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Thanh toán thất bại sau khi hết hạn giữ chỗ.");
                releaseReservation(saved.getId());
                return response(saved);
            }
            return response(bookingRepository.save(booking));
        }
        List<RoomSlot> claimedSlots = bookingSlotIds(booking).stream().map(this::claimSlot).toList();
        if (!holdValid) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
            markLatePaid(id);
            releaseReservation(booking.getId());
            return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                    "Thanh toán đến sau hạn; booking đã hết hiệu lực và cọc chờ hoàn."));
        }
        boolean depositPaused = claimedSlots.stream().anyMatch(RoomSlot::isDepositPaused);
        if (!depositPaused && hasReservation(booking.getId())) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setDepositStatus(DepositStatus.PAID);
            createSlotContracts(booking);
        } else {
            releaseReservation(booking.getId());
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
            markLatePaid(id);
        }
        return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                booking.getStatus() == BookingStatus.CONFIRMED ? "Đã xác minh cọc; booking được xác nhận."
                        : depositPaused ? "Chỗ đang tạm ngưng đặt cọc; khoản tiền đã nhận chờ hoàn."
                        : "Slot đã được giữ; chờ Owner duyệt hoàn cọc."));
    }

    private BookingResponse processLatePayment(Booking booking) {
        releaseReservation(booking.getId());
        booking.setDepositStatus(DepositStatus.PAID);
        markLatePaid(booking.getId());
        Booking saved = saveTransition(booking, BookingStatus.EXPIRED, "Khoản thanh toán đến muộn; booking không được khôi phục và cọc chờ hoàn.");
        eventPublisher.publishEvent(new BookingStatusChangedEvent(saved.getId(), saved.getTenantId(),
                saved.getStatus(), saved.getDepositStatus(), "Khoản cọc đến muộn cần Owner xử lý hoàn tiền."));
        return response(saved);
    }

    @Override
    @Transactional
    public BookingResponse approveRefund(String id, AuthPrincipal principal) {
        requireRole(principal, "OWNER", "MANAGER", "ADMIN");
        Booking booking = find(id);
        ensureCanManage(booking, principal);
        if ((booking.getStatus() != BookingStatus.EXPIRED && booking.getStatus() != BookingStatus.CANCELLED)
                || booking.getDepositStatus() != DepositStatus.PAID)
            throw new ConflictException("Chỉ tiền cọc của booking hết hạn/hủy mới chờ duyệt hoàn");
        booking.setDepositStatus(DepositStatus.PROCESSING);
        Booking saved = bookingRepository.save(booking);
        eventPublisher.publishEvent(new BookingStatusChangedEvent(saved.getId(), saved.getTenantId(), saved.getStatus(), saved.getDepositStatus(), "Owner đã duyệt xử lý hoàn tiền cọc."));
        return response(saved);
    }

    @Override
    public BookingResponse update(String id, BookingUpdateRequest request) {
        throw new UnsupportedOperationException("Dùng endpoint thao tác booking theo trạng thái");
    }

    @Override
    public void delete(String id) {
        throw new UnsupportedOperationException("Booking không được xóa qua API CRUD");
    }

    private void expireOverdueBookings() {
        Instant now = clock.instant();
        List<Booking> overdue = new ArrayList<>(bookingRepository.findByStatusAndHoldExpiresAtLessThanEqualAndIsDeletedFalse(BookingStatus.AWAITING_PAYMENT, now)
                .stream().filter(b -> !bookingSlotIds(b).isEmpty()).toList());
        bookingRepository.findByStatusAndPaymentDeadlineLessThanEqualAndIsDeletedFalse(BookingStatus.AWAITING_PAYMENT, now)
                .stream().filter(b -> !bookingSlotIds(b).isEmpty())
                .forEach(b -> { if (overdue.stream().noneMatch(x -> x.getId().equals(b.getId()))) overdue.add(b); });
        for (Booking booking : overdue) {
            BookingStatus previous = booking.getStatus();
            claimRemainingSlots(booking);
            expireBooking(booking);
            saveTransition(booking, previous, "Đã hết hạn thanh toán/giữ chỗ.");
            releaseReservation(booking.getId());
        }
        List<Booking> missedCheckIns = bookingRepository.findByStatusAndCheckInDeadlineLessThanEqualAndIsDeletedFalse(
                BookingStatus.CONFIRMED, now).stream().filter(b -> !bookingSlotIds(b).isEmpty()).toList();
        for (Booking booking : missedCheckIns) {
            BookingStatus previous = booking.getStatus();
            claimRemainingSlots(booking);
            booking.setStatus(BookingStatus.EXPIRED);
            if (paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                    .anyMatch(payment -> payment.getStatus() == PaymentStatus.SUCCESS))
                booking.setDepositStatus(DepositStatus.PAID);
            Booking saved = saveTransition(booking, previous, "Quá hạn check-in; booking hết hiệu lực theo chính sách hủy đã gửi.");
            releaseReservation(saved.getId());
            contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                    .filter(contract -> contract.getStatus() == ContractStatus.DRAFT)
                    .forEach(contract -> {
                        contract.setStatus(ContractStatus.TERMINATED);
                        contract.setTerminatedAt(now);
                        contract.setTerminationReason("Đã quá hạn check-in theo điều khoản booking.");
                        contractRepository.save(contract);
                    });
            roomSlotRepository.findByIdAndIsDeletedFalse(bookingSlotIds(saved).getFirst())
                    .map(RoomSlot::getRoomId)
                    .flatMap(roomRepository::findByIdAndIsDeletedFalse)
                    .ifPresent(this::refreshRoomStatus);
        }
    }

    private void expireBooking(Booking booking) {
        booking.setStatus(BookingStatus.EXPIRED);
        if (paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS))
            booking.setDepositStatus(DepositStatus.PAID);
    }

    private void ensureTermsCurrent(Booking booking) {
        Instant now = clock.instant();
        if (booking.getPaymentDeadline() == null || !booking.getPaymentDeadline().isAfter(now)
                || booking.getHoldExpiresAt() == null || !booking.getHoldExpiresAt().isAfter(now))
            throw new ConflictException("Thời hạn giữ chỗ đã hết");
        if (booking.getHoldingDepositAmount() == null)
            throw new ConflictException("Booking chưa xác định được tiền cọc");
    }

    private void validatePaymentAllowed(Booking booking) {
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT)
            throw new ConflictException("Booking không còn chờ thanh toán");
        ensureTermsCurrent(booking);
        for (String slotId : bookingSlotIds(booking)) {
            if (roomSlot(slotId).isDepositPaused()) throw new ConflictException("Chỗ này đang tạm ngưng đặt cọc.");
        }
        requireReservation(booking.getId());
    }

    private void ensureNoOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        if (hasOccupancyOverlap(roomSlotId, start, end, excludeBookingId))
            throw new ConflictException("Slot đã có lượt ở/giữ chỗ trùng trong khoảng ngày này");
    }

    private boolean hasOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        return blockingOccupancies(List.of(roomSlotId)).getOrDefault(roomSlotId, List.of()).stream()
                .filter(occupancy -> excludeBookingId == null || !excludeBookingId.equals(occupancy.getBookingId()))
                .anyMatch(occupancy -> (occupancy.getEndDate() == null || !occupancy.getEndDate().isBefore(start))
                        && (end == null || occupancy.getStartDate() == null || !occupancy.getStartDate().isAfter(end)));
    }

    private RoomSlot claimSlot(String roomSlotId) {
        return claimSlot(roomSlot(roomSlotId));
    }

    private RoomSlot claimSlot(RoomSlot slot) {
        try {
            return roomSlotRepository.save(slot);
        } catch (OptimisticLockingFailureException exception) {
            throw new ConflictException("Slot vừa được cập nhật bởi yêu cầu khác; vui lòng thử lại");
        }
    }

    private List<String> bookingSlotIds(Booking booking) {
        if (booking.getRoomSlotIds() != null && !booking.getRoomSlotIds().isEmpty()) return booking.getRoomSlotIds();
        return booking.getRoomSlotId() == null ? List.of() : List.of(booking.getRoomSlotId());
    }

    private void claimBookingSlots(Booking booking) {
        bookingSlotIds(booking).forEach(this::claimSlot);
    }

    private void claimRemainingSlots(Booking booking) {
        for (String slotId : bookingSlotIds(booking)) {
            roomSlotRepository.findByIdAndIsDeletedFalse(slotId).ifPresent(this::claimSlot);
        }
    }

    private List<RoomSlotOccupancy> reservations(Booking booking) {
        return bookingSlotIds(booking).stream().map(slotId -> reservation(booking, slotId)).toList();
    }

    /**
     * Optional services picked while booking, taken from the branch's slot service catalog.
     * They are only a wish list: the contract starts using them once staff activate the contract.
     */
    private List<SelectedServiceSnapshot> selectedServices(List<BookingCreateRequest.SelectedServiceRequest> requested, String branchId) {
        List<SelectedServiceSnapshot> selected = new ArrayList<>();
        if (requested == null || requested.isEmpty()) return selected;
        Set<String> seen = new HashSet<>();
        for (BookingCreateRequest.SelectedServiceRequest item : requested) {
            if (!seen.add(item.serviceId())) throw new BadRequestException("Không được chọn lặp dịch vụ");
            if (item.quantity() != null && item.quantity() == 0) continue;
            var service = slotServiceRepository.findByIdAndIsDeletedFalse(item.serviceId())
                    .filter(s -> s.getStatus() == com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus.ACTIVE)
                    .filter(s -> branchId.equals(s.getBranchId()))
                    .orElseThrow(() -> new BadRequestException("Có dịch vụ không tồn tại hoặc đã ngừng cung cấp"));
            SelectedServiceSnapshot snapshot = new SelectedServiceSnapshot();
            snapshot.setServiceId(service.getId());
            snapshot.setName(service.getName());
            snapshot.setUnit(service.getUnit());
            snapshot.setUnitPrice(service.getUnitPrice());
            snapshot.setCalculationType("FIXED");
            snapshot.setQuantityRule("USER_INPUT");
            snapshot.setMandatory(false);
            snapshot.setQuantity(item.quantity() == null ? 1 : item.quantity());
            selected.add(snapshot);
        }
        return selected;
    }

    /**
     * After the shared deposit is paid: one DRAFT contract per booked slot, each to be signed and
     * approved on its own. Rent / deposit are the slot's share of the room price. Optional services
     * picked while booking go on the first contract. Idempotent.
     */
    private void createSlotContracts(Booking booking) {
        List<Contract> existing = contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId());
        Map<String, Contract> existingBySlot = existing.stream()
                .filter(contract -> contract.getRenewedFromContractId() == null && contract.getRoomSlotId() != null)
                .collect(Collectors.toMap(Contract::getRoomSlotId, contract -> contract, (first, second) -> first));
        List<RoomSlot> slots = bookingSlotIds(booking).stream().map(this::roomSlot).toList();
        Room room = room(slots.getFirst().getRoomId());
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(booking.getTenantId()).orElse(null);
        String managerAccountId = branchManagers.managerAccountId(room.getBranchId()).orElse(null);
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            RoomSlot slot = slots.get(i);
            Contract existingContract = existingBySlot.get(slot.getId());
            if (existingContract != null) {
                ids.add(existingContract.getId());
                continue;
            }
            Contract contract = contractTemplates.prepare(room, slot);
            contract.setBookingId(booking.getId());
            LocalDate slotStart = booking.getSlotMoveInDates() == null ? null : booking.getSlotMoveInDates().get(slot.getId());
            contract.setStartDate(slotStart == null ? booking.getExpectedMoveInDate() : slotStart);
            contract.setTenantId(booking.getTenantId());
            contract.setManagerId(managerAccountId);
            contract.setContractNumber(contractService.nextContractNumber());
            contractTemplates.fillTenant(contract, tenant);
            contract.setEvidenceDeadline(clock.instant().plusSeconds(72 * 60 * 60));
            if (i == 0 && booking.getSelectedServices() != null) {
                contract.getServices().addAll(booking.getSelectedServices().stream().map(service -> {
                    ContractServiceSnapshot snapshot = new ContractServiceSnapshot();
                    snapshot.setServiceId(service.getServiceId());
                    snapshot.setName(service.getName());
                    snapshot.setUnit(service.getUnit());
                    snapshot.setUnitPrice(service.getUnitPrice());
                    snapshot.setCalculationType(service.getCalculationType());
                    snapshot.setMandatory(service.isMandatory());
                    snapshot.setSelected(true);
                    snapshot.setQuantity(service.getQuantity());
                    return snapshot;
                }).toList());
            }
            contract.setStatus(ContractStatus.DRAFT);
            contractTemplates.queuePdf(contract);
            ids.add(contractRepository.save(contract).getId());
        }
        booking.setContractIds(ids);
        booking.setContractId(ids.getFirst());
    }

    private void markLatePaid(String bookingId) {
        paymentRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                .forEach(payment -> {
                    payment.setStatus(PaymentStatus.LATE_PAID);
                    paymentRepository.save(payment);
                });
    }

    private RoomSlotOccupancy reservation(Booking booking, String slotId) {
        RoomSlotOccupancy occupancy = new RoomSlotOccupancy();
        occupancy.setRoomSlotId(slotId);
        occupancy.setBookingId(booking.getId());
        occupancy.setStartDate(booking.getSlotMoveInDates().get(slotId));
        occupancy.setEndDate(booking.getExpectedMoveOutDate());
        occupancy.setStatus(OccupancyStatus.RESERVED);
        return occupancy;
    }

    private boolean hasReservation(String bookingId) {
        List<RoomSlotOccupancy> reservations = roomSlotOccupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .filter(occupancy -> occupancy.getStatus() == OccupancyStatus.RESERVED).toList();
        Booking booking = bookingRepository.findByIdAndIsDeletedFalse(bookingId).orElse(null);
        return booking != null && !bookingSlotIds(booking).isEmpty()
                && bookingSlotIds(booking).stream().allMatch(slotId -> reservations.stream().anyMatch(item -> slotId.equals(item.getRoomSlotId())));
    }

    private void requireReservation(String bookingId) {
        if (!hasReservation(bookingId))
            throw new ConflictException("Không tìm thấy reservation của booking trong RoomSlotOccupancy");
    }

    private void updateReservationRange(Booking booking, LocalDate start, LocalDate end) {
        String bookingId = booking.getId();
        List<RoomSlotOccupancy> reservations = roomSlotOccupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .filter(occupancy -> occupancy.getStatus() == OccupancyStatus.RESERVED).toList();
        if (reservations.isEmpty()) throw new ConflictException("Không tìm thấy reservation của booking trong RoomSlotOccupancy");
        reservations.forEach(occupancy -> {
            if (booking.getSlotMoveInDates() == null)
                occupancy.setStartDate(start);
            occupancy.setEndDate(end);
            roomSlotOccupancyRepository.save(occupancy);
        });
    }

    private void releaseReservation(String bookingId) {
        roomSlotOccupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .filter(occupancy -> occupancy.getStatus() == OccupancyStatus.RESERVED)
                .forEach(occupancy -> {
                    occupancy.setStatus(OccupancyStatus.ENDED);
                    roomSlotOccupancyRepository.save(occupancy);
                });
    }

    private Booking saveTransition(Booking booking, BookingStatus previous, String note) {
        if (booking.getTimeline() == null) booking.setTimeline(new ArrayList<>());
        booking.getTimeline().add(new BookingTimelineEntry(booking.getStatus().name(), clock.instant(), note));
        Booking saved = bookingRepository.save(booking);
        eventPublisher.publishEvent(new BookingStatusChangedEvent(saved.getId(), saved.getTenantId(), saved.getStatus(), saved.getDepositStatus(), note));
        return saved;
    }

    private void validateRange(LocalDate start, LocalDate end) {
        if (start == null || end == null || !end.isAfter(start))
            throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu");
    }

    private Booking find(String id) {
        return bookingRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy booking"));
    }

    private Room room(String id) {
        return roomRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
    }

    private RoomSlot roomSlot(String id) {
        if (id == null || id.isBlank())
            throw new ConflictException("Booking cũ chưa được liên kết RoomSlotId và cần migration");
        return roomSlotRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy slot"));
    }

    /**
     * Tenant bị tạm ngưng (INACTIVE/LOCKED) hoặc bị chặn tại đúng chi nhánh đó thì không được đặt phòng
     * ở chi nhánh này. Chặn tại tầng nghiệp vụ để mọi luồng tạo booking đều đi qua một chỗ.
     */
    private void ensureTenantActiveAtBranch(Tenant tenant, String branchId) {
        if (tenant.getStatus() == TenantStatus.INACTIVE) {
            throw new ForbiddenException("Tài khoản người thuê đang bị tạm ngưng, không thể đặt phòng");
        }
        if (tenant.getStatus() == TenantStatus.LOCKED) {
            throw new ForbiddenException("Tài khoản người thuê đang bị khoá, không thể đặt phòng");
        }
        if (tenant.isInactiveInBranch(branchId)) {
            throw new ForbiddenException("Tài khoản của bạn hiện đang tạm ngưng hoạt động tại cơ sở này");
        }
    }

    private Tenant tenant(AuthPrincipal principal) {        if (principal.email() == null) throw new ForbiddenException("Tài khoản không có email");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElseGet(() -> {
            User user = userRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản Tenant"));
            Tenant created = new Tenant();
            created.setEmail(user.getEmail());
            created.setFullName(user.getFullName());
            created.setPhone(user.getPhone());
            created.setIdCardNumber(user.getCccdNumber());
            created.setAddress(user.getPermanentAddress());
            if (user.getDateOfBirth() != null && !user.getDateOfBirth().isBlank()) {
                try {
                    created.setDateOfBirth(LocalDate.parse(user.getDateOfBirth().strip()));
                } catch (Exception ignored) {
                }
            }
            return tenantRepository.save(created);
        });
    }

    private void ensureTenantOwns(Booking booking, AuthPrincipal principal) {
        if (!booking.getTenantId().equals(tenant(principal).getId()))
            throw new ForbiddenException("Bạn không có quyền thao tác booking này");
    }

    private void ensureCanView(Booking booking, AuthPrincipal principal) {
        if (isRole(principal, "TENANT")) ensureTenantOwns(booking, principal);
        else if (!isRole(principal, "ADMIN")) {
            requireRole(principal, "OWNER", "MANAGER");
            Room room = bookingSlotIds(booking).stream().findFirst()
                    .flatMap(roomSlotRepository::findById)
                    .map(RoomSlot::getRoomId)
                    .flatMap(roomRepository::findById)
                    .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng liên kết với yêu cầu giữ chỗ"));
            branchAccess.requireManagementAccess(room.getBranchId(), principal);
        }
    }

    private void ensureCanManage(Booking booking, AuthPrincipal principal) {
        if (isRole(principal, "ADMIN")) return;
        requireRole(principal, "OWNER", "MANAGER");
        branchAccess.requireManagementAccess(room(roomSlot(bookingSlotIds(booking).getFirst()).getRoomId()).getBranchId(), principal);
    }

    private String managerBranch(AuthPrincipal principal) {
        return branchAccess.managedBranches(principal).stream().findFirst()
                .orElseThrow(() -> new ForbiddenException("Tài khoản chưa được phân công chi nhánh đang hoạt động"))
                .id();
    }

    private boolean isRole(AuthPrincipal principal, String role) {
        return principal != null && role.equals(principal.role());
    }

    private void requireRole(AuthPrincipal principal, String... roles) {
        for (String role : roles) if (isRole(principal, role)) return;
        throw new ForbiddenException("Vai trò hiện tại không được phép thực hiện thao tác này");
    }

    private BookingResponse response(Booking b) {
        List<String> slotIds = bookingSlotIds(b);
        List<RoomSlot> slots = historicalSlots(b);
        Room room = historicalRoom(slots).orElse(null);
        Branch branch = room == null || room.getBranchId() == null ? null
                : branchRepository.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        Map<String, String> codesById = new LinkedHashMap<>();
        slots.forEach(slot -> codesById.put(slot.getId(), slot.getSlotCode()));
        String primarySlotId = slotIds.isEmpty() ? null : slotIds.getFirst();
        List<String> slotCodes = slotIds.stream().map(id -> Objects.toString(codesById.get(id), "—")).toList();
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(b.getTenantId()).orElse(null);
        User user = tenant == null ? null : userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null);
        return new BookingResponse(b.getId(), b.getTenantId(), primarySlotId, codesById.get(primarySlotId), slotIds,
                slotCodes, b.getExpectedMoveInDate(), b.getSlotMoveInDates(),
                b.getExpectedMoveOutDate(), b.getHoldingDepositAmount(), b.getPaymentDeadline(), b.getHoldExpiresAt(), b.getCheckInDeadline(), b.getContractId(),
                b.getContractIds() == null ? List.of() : List.copyOf(b.getContractIds()),
                b.getCancellationPolicy(), b.getDepositStatus(), b.getRejectReason(), b.getStatus(),
                b.getTermsAcceptedAt(), b.getCreatedAt(), b.getUpdatedAt(), user == null ? b.getTenantId() : user.getId(),
                tenant == null ? null : tenant.getFullName(), tenant == null ? null : tenant.getEmail(),
                tenant == null ? null : tenant.getPhone(), room == null ? null : room.getRoomNumber(),
                room == null ? null : room.getBranchId(),
                branch == null ? null : branch.getName(), b.getTimeline() == null ? List.of() : List.copyOf(b.getTimeline()),
                b.getSelectedServices() == null ? List.of() : List.copyOf(b.getSelectedServices()));
    }

    private List<RoomSlot> historicalSlots(Booking booking) {
        return bookingSlotIds(booking).stream().filter(Objects::nonNull)
                .map(roomSlotRepository::findById).flatMap(Optional::stream).toList();
    }

    private Optional<Room> historicalRoom(List<RoomSlot> slots) {
        return slots.stream().map(RoomSlot::getRoomId).filter(Objects::nonNull).distinct()
                .map(roomRepository::findById).flatMap(Optional::stream).findFirst();
    }

    private void refreshRoomStatus(Room room) {
        if (room.getStatus() == com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus.MAINTENANCE
                || room.getStatus() == com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus.INACTIVE) return;
        List<String> slotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(List.of(room.getId())).stream()
                .map(RoomSlot::getId).toList();
        if (slotIds.isEmpty()) return;
        var active = roomSlotOccupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(slotIds, List.of(OccupancyStatus.ACTIVE));
        boolean allUsed = slotIds.stream().allMatch(slotId -> active.stream().anyMatch(occupancy -> slotId.equals(occupancy.getRoomSlotId())));
        room.setStatus(allUsed ? com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus.OCCUPIED
                : com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus.AVAILABLE);
        roomRepository.save(room);
    }

    private BookingPaymentResponse paymentResponse(Payment p, String paymentUrl) {
        return new BookingPaymentResponse(p.getId(), p.getBookingId(), p.getAmount(), p.getTransactionCode(),
                p.getMethod(), p.getStatus(), p.getCreatedAt(), p.getPaidAt(), paymentUrl);
    }
    @Override
    public List<OverviewBooking> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var scope = MongoQueryHelper.byReferenceIds("roomSlotIds", ids);
        var legacy = MongoQueryHelper.byReferenceIds("roomSlotId", ids);
        var query = new org.springframework.data.mongodb.core.query.BasicQuery(
                new org.bson.Document("$or", List.of(scope.getQueryObject(), legacy.getQueryObject())));
        query.fields().include("tenantId", "roomSlotId", "roomSlotIds", "contractId", "expectedMoveInDate", "holdExpiresAt", "paymentDeadline", "checkInDeadline", "status");
        return mongoTemplate.find(query, Booking.class).stream()
                .map(item -> new OverviewBooking(item.getId(), item.getTenantId(), item.getRoomSlotId(), item.getRoomSlotIds(), item.getContractId(), item.getExpectedMoveInDate(), item.getHoldExpiresAt(), item.getPaymentDeadline(), item.getCheckInDeadline(), item.getStatus())).toList();
    }

    @Override
    public java.util.List<ActivitySnapshot> readActivitiesForOverview(java.util.List<String> ids, java.time.Instant from, java.time.Instant to) {
        if (ids.isEmpty()) return java.util.List.of();
        var query = MongoQueryHelper.byReferenceIds("_id", ids);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("timeline.at").gte(from).lt(to));
        query.fields().include("timeline");
        var result = new java.util.ArrayList<ActivitySnapshot>();
        for (var item : mongoTemplate.find(query, Booking.class)) {
            if (item.getTimeline() == null) continue;
            for (int i = 0; i < item.getTimeline().size(); i++) {
                var event = item.getTimeline().get(i);
                String action = event.status();
                if (i > 0) {
                    String previous = item.getTimeline().get(i - 1).status();
                    if (java.util.Objects.equals(action, previous)) action = "UPDATED";
                    else if ("AWAITING_PAYMENT".equals(action)
                            && ("REQUESTED".equals(previous) || "PENDING".equals(previous))) action = "APPROVED";
                }
                result.add(new ActivitySnapshot(item.getId() + ":" + i, item.getId(), action, event.at(), null, null, event.note()));
            }
        }
        return result.stream().filter(e -> e.within(from, to)).toList();
    }
}
