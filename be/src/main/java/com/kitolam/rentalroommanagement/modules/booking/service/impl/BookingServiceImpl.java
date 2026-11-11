package com.kitolam.rentalroommanagement.modules.booking.service.impl;

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
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.service.support.RoomSlotAvailabilityRoller;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.serviceitem.document.ServiceItem;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.QuantityRule;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.repository.ServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final ContractRepository contractRepository;
    private final ContractService contractService;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository roomSlotOccupancyRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final PaymentRepository paymentRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;
    private final BranchService branchAccess;

    @Value("${contract.template.download-url:https://www.youtube.com/}")
    private String contractUrl;

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
        // Mốc so sánh ngày nhả phòng phải theo giờ Việt Nam, không theo UTC của clock.
        LocalDate todayVietnam = todayVietnam();
        LocalDate holdStart = todayVietnam;
        for (String slotId : slotIds) ensureNoOccupancyOverlap(slotId, holdStart, null, null);
        // Ngày bắt đầu thuê lấy theo slot sẵn sàng muộn nhất; slot sắp hết hạn thuê dùng ngày phòng thực sự trống.
        Map<String, LocalDate> nextFree = nextFreeDates(slotIds);
        LocalDate availableFrom = slots.stream()
                .map(slot -> effectiveAvailableFrom(slot, nextFree.get(slot.getId()), todayVietnam))
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        BigDecimal deposit = slots.stream().map(slot -> {
            BigDecimal listed = room(slot.getRoomId()).getListedDepositAmount();
            if (listed == null) throw new BadRequestException("Phòng chưa cấu hình tiền cọc");
            return listed;
        }).reduce(BigDecimal.ZERO, BigDecimal::add);

        Booking booking = new Booking();
        booking.setTenantId(tenant.getId());
        booking.setRoomSlotId(slots.getFirst().getId());
        booking.setRoomSlotIds(slotIds);
        booking.setExpectedMoveInDate(availableFrom);
        booking.setHoldingDepositAmount(deposit);
        Instant deadline = clock.instant().plusSeconds(24 * 60 * 60);
        booking.setPaymentDeadline(deadline);
        booking.setHoldExpiresAt(deadline);
        booking.setSelectedServices(selectedServices(request.selectedServices(), slotIds.size()));
        booking.setStatus(BookingStatus.AWAITING_PAYMENT);
        booking.setDepositStatus(DepositStatus.UNPAID);
        Booking saved = saveTransition(booking, null, "Đã giữ các slot trong 24 giờ; đang chờ thanh toán cọc.");
        reservations(saved).forEach(roomSlotOccupancyRepository::save);
        return response(saved);
    }

    @Override
    @Transactional
    public RoomAvailabilityResponse checkAvailability(String roomSlotId, LocalDate startDate, LocalDate endDate) {
        expireOverdueBookings();
        validateRange(startDate, endDate);
        RoomSlot slot = roomSlot(roomSlotId);
        boolean available = !hasOccupancyOverlap(roomSlotId, startDate, endDate, null);
        Map<String, LocalDate> nextFree = nextFreeDates(List.of(roomSlotId));
        // Slot trống: ngày theo availableFrom của slot. Slot đang thuê: chỉ biết ngày nhận phòng khi lượt ở có endDate.
        LocalDate availableFrom = available ? effectiveAvailableFrom(slot, null, todayVietnam())
                : nextFree.get(roomSlotId);
        return new RoomAvailabilityResponse(roomSlotId, slot.getSlotCode(), startDate, endDate, available,
                available ? null : releaseReason(nextFree.get(roomSlotId), availableFrom), availableFrom);
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

        List<OccupancyStatus> blockingStatuses = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
        List<RoomSlotOccupancy> overlapping = new ArrayList<>(roomSlotOccupancyRepository
                .findByRoomSlotIdInAndStatusInAndStartDateLessThanAndEndDateGreaterThanAndIsDeletedFalse(
                        ids, blockingStatuses, endDate, startDate));
        overlapping.addAll(roomSlotOccupancyRepository
                .findByRoomSlotIdInAndStatusInAndStartDateLessThanAndEndDateIsNullAndIsDeletedFalse(
                        ids, blockingStatuses, endDate));
        // Lượt ở sắp hết hạn được nhả trước 14 ngày, không còn chặn nếu ngày đặt mới rơi vào sau mốc nhả.
        var blockedSlotIds = overlapping.stream()
                .filter(occupancy -> occupancy.getEndDate() == null
                        || !RoomSlotAvailabilityRoller.releasesBefore(occupancy.getEndDate(), startDate))
                .map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet());

        Map<String, LocalDate> nextFree = nextFreeDates(ids);
        LocalDate todayVietnam = todayVietnam();
        return ids.stream().map(id -> {
            RoomSlot slot = slots.get(id);
            boolean available = !blockedSlotIds.contains(id);
            // Slot trống: ngày theo availableFrom của slot. Slot đang thuê: chỉ biết ngày nhận phòng khi lượt ở có endDate.
            LocalDate availableFrom = available ? effectiveAvailableFrom(slot, null, todayVietnam) : nextFree.get(id);
            return new RoomAvailabilityResponse(id, slot.getSlotCode(), startDate, endDate, available,
                    available ? null : releaseReason(nextFree.get(id), availableFrom), availableFrom);
        }).toList();
    }

    /** Ngày phòng thực sự trống theo lượt ở hiện tại (endDate muộn nhất); null nếu không có lượt ở hữu hạn. */
    private Map<String, LocalDate> nextFreeDates(Collection<String> roomSlotIds) {
        List<OccupancyStatus> blockingStatuses = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
        return roomSlotOccupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(roomSlotIds, blockingStatuses)
                .stream()
                .filter(occupancy -> occupancy.getEndDate() != null)
                .collect(Collectors.toMap(RoomSlotOccupancy::getRoomSlotId, RoomSlotOccupancy::getEndDate,
                        (a, b) -> a.isAfter(b) ? a : b));
    }

    /**
     * Ngày bắt đầu thuê hiệu dụng của slot: availableFrom trên slot (đã dời +7 nếu quá khứ) và, nếu slot đang
     * có lượt ở, ngày phòng thực sự trống — lấy mốc muộn hơn để không bao giờ nhận phòng khi còn người thuê.
     */
    private LocalDate effectiveAvailableFrom(RoomSlot slot, LocalDate nextFreeDate, LocalDate todayVietnam) {
        LocalDate rolled = RoomSlotAvailabilityRoller.rollForward(slot.getAvailableFrom(), todayVietnam);
        if (nextFreeDate == null) return rolled;
        LocalDate freeAt = nextFreeDate.isBefore(todayVietnam) ? todayVietnam : nextFreeDate;
        return rolled == null || freeAt.isAfter(rolled) ? freeAt : rolled;
    }

    private LocalDate todayVietnam() {
        return RoomSlotAvailabilityRoller.todayVietnam(clock);
    }

    private String releaseReason(LocalDate nextFreeDate, LocalDate availableFrom) {
        if (nextFreeDate == null) return "Chỗ đã có lượt ở/giữ chỗ trùng hoặc hiện không nhận đặt.";
        return "Chỗ đang có người thuê; có thể đặt cọc từ "
                + RoomSlotAvailabilityRoller.releaseDate(nextFreeDate) + " (nhả trước "
                + RoomSlotAvailabilityRoller.RELEASE_LEAD_DAYS + " ngày), nhận phòng từ " + availableFrom + ".";
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
            List<String> roomIds = roomRepository.findByBranchIdAndIsDeletedFalse(branchId).stream().map(Room::getId).toList();
            List<ObjectId> roomSlotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(roomIds).stream()
                    .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            criteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").in(roomSlotIds), Criteria.where("roomSlotIds").in(roomSlotIds)));
        } else {
            requireRole(principal, "OWNER", "ADMIN");
            if (isRole(principal, "OWNER")) {
                var branches = branchAccess.ownedBranchIds(principal.userId());
                var ownedRoomIds = roomRepository.findByBranchIdInAndIsDeletedFalse(branches).stream()
                        .map(Room::getId).toList();
                var ownedRoomSlotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(ownedRoomIds).stream()
                        .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
                criteria.add(new Criteria().orOperator(Criteria.where("roomSlotId").in(ownedRoomSlotIds), Criteria.where("roomSlotIds").in(ownedRoomSlotIds)));
            }
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
        }
        if (filter.roomSlotId() != null) criteria.add(new Criteria().orOperator(
                Criteria.where("roomSlotId").is(MongoQueryHelper.toObjectId(filter.roomSlotId())),
                Criteria.where("roomSlotIds").is(MongoQueryHelper.toObjectId(filter.roomSlotId()))));
        if (filter.roomId() != null) {
            List<ObjectId> roomSlotIds = roomSlotRepository.findByRoomIdAndIsDeletedFalse(filter.roomId()).stream()
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
            List<ObjectId> matchingRoomSlotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(matchingRoomIds).stream()
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
        for (String slotId : bookingSlotIds(booking)) ensureNoOccupancyOverlap(slotId, start, end, booking.getId());

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
        updateReservationRange(booking.getId(), start, end);
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
        Contract draft = confirmedBeforeHandover
                ? contractRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).orElse(null) : null;
        if (draft != null && draft.getStatus() != ContractStatus.DRAFT)
            throw new ConflictException("Booking đã hoàn tất bàn giao, không thể hủy");
        if (booking.getStatus() != BookingStatus.REQUESTED && booking.getStatus() != BookingStatus.AWAITING_PAYMENT && !confirmedBeforeHandover)
            throw new ConflictException("Trạng thái hiện tại không cho phép hủy yêu cầu");
        if (!confirmedBeforeHandover && paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS))
            throw new ConflictException("Đã nhận thanh toán; vui lòng liên hệ Owner để xử lý hoàn tiền");
        if (draft != null) {
            draft.setStatus(ContractStatus.TERMINATED);
            draft.setTerminatedAt(clock.instant());
            draft.setTerminationReason("Owner/Manager không thể bàn giao phòng.");
            contractRepository.save(draft);
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
        claimBookingSlots(booking);
        if (!holdValid) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
            markLatePaid(id);
            releaseReservation(booking.getId());
            return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                    "Thanh toán đến sau hạn; booking đã hết hiệu lực và cọc chờ hoàn."));
        }
        if (hasReservation(booking.getId())) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setDepositStatus(DepositStatus.PAID);
            createTemporaryContract(booking);
        } else {
            releaseReservation(booking.getId());
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
            markLatePaid(id);
        }
        return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                booking.getStatus() == BookingStatus.CONFIRMED ? "Đã xác minh cọc; booking được xác nhận."
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
                .stream().filter(b -> b.getRoomSlotId() != null).toList());
        bookingRepository.findByStatusAndPaymentDeadlineLessThanEqualAndIsDeletedFalse(BookingStatus.AWAITING_PAYMENT, now)
                .stream().filter(b -> b.getRoomSlotId() != null)
                .forEach(b -> { if (overdue.stream().noneMatch(x -> x.getId().equals(b.getId()))) overdue.add(b); });
        for (Booking booking : overdue) {
            BookingStatus previous = booking.getStatus();
            claimBookingSlots(booking);
            expireBooking(booking);
            saveTransition(booking, previous, "Đã hết hạn thanh toán/giữ chỗ.");
            releaseReservation(booking.getId());
        }
        List<Booking> missedCheckIns = bookingRepository.findByStatusAndCheckInDeadlineLessThanEqualAndIsDeletedFalse(
                BookingStatus.CONFIRMED, now).stream().filter(b -> b.getRoomSlotId() != null).toList();
        for (Booking booking : missedCheckIns) {
            BookingStatus previous = booking.getStatus();
            claimBookingSlots(booking);
            booking.setStatus(BookingStatus.EXPIRED);
            if (paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                    .anyMatch(payment -> payment.getStatus() == PaymentStatus.SUCCESS))
                booking.setDepositStatus(DepositStatus.PAID);
            Booking saved = saveTransition(booking, previous, "Quá hạn check-in; booking hết hiệu lực theo chính sách hủy đã gửi.");
            releaseReservation(saved.getId());
            contractRepository.findByBookingIdAndIsDeletedFalse(booking.getId())
                    .filter(contract -> contract.getStatus() == ContractStatus.DRAFT)
                    .ifPresent(contract -> {
                        contract.setStatus(ContractStatus.TERMINATED);
                        contract.setTerminatedAt(now);
                        contract.setTerminationReason("Đã quá hạn check-in theo điều khoản booking.");
                        contractRepository.save(contract);
                    });
            refreshRoomStatus(room(roomSlot(saved.getRoomSlotId()).getRoomId()));
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
        requireReservation(booking.getId());
    }

    private void ensureNoOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        if (hasOccupancyOverlap(roomSlotId, start, end, excludeBookingId))
            throw new ConflictException("Slot đã có lượt ở/giữ chỗ trùng trong khoảng ngày này");
    }

    private boolean hasOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        List<OccupancyStatus> blockingStatuses = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
        if (end == null) {
            return roomSlotOccupancyRepository.findByRoomSlotIdAndStatusInAndIsDeletedFalse(roomSlotId, blockingStatuses)
                    .stream()
                    .filter(occupancy -> excludeBookingId == null || !excludeBookingId.equals(occupancy.getBookingId()))
                    .anyMatch(occupancy -> occupancy.getEndDate() == null
                            || (occupancy.getEndDate().isAfter(start)
                                && !RoomSlotAvailabilityRoller.releasesBefore(occupancy.getEndDate(), start)));
        }
        return getOverlappingOccupancies(roomSlotId, start, end, excludeBookingId).stream()
                .anyMatch(occupancy -> occupancy.getEndDate() == null
                        || !RoomSlotAvailabilityRoller.releasesBefore(occupancy.getEndDate(), start));
    }

    /**
     * Các lượt ở hiện chặn khoảng ngày [start, end). Một lượt ở sắp hết hạn được coi là đã nhả cho khách mới
     * kể từ {@code endDate - 14 ngày}, nên nếu ngày đặt mới rơi vào sau mốc đó thì lượt ở không còn chặn.
     */
    private List<RoomSlotOccupancy> getOverlappingOccupancies(String roomSlotId, LocalDate start, LocalDate end,
                                                               String excludeBookingId) {
        List<OccupancyStatus> blockingStatuses = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
        List<RoomSlotOccupancy> overlapping = new ArrayList<>(roomSlotOccupancyRepository
                .findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateGreaterThanAndIsDeletedFalse(
                        roomSlotId, blockingStatuses, end, start));
        overlapping.addAll(roomSlotOccupancyRepository
                .findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateIsNullAndIsDeletedFalse(
                        roomSlotId, blockingStatuses, end));
        return overlapping.stream()
                .filter(occupancy -> excludeBookingId == null || !excludeBookingId.equals(occupancy.getBookingId()))
                .toList();
    }

    private RoomSlot claimSlot(String roomSlotId) {
        RoomSlot slot = roomSlot(roomSlotId);
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

    private List<RoomSlotOccupancy> reservations(Booking booking) {
        return bookingSlotIds(booking).stream().map(slotId -> reservation(booking, slotId)).toList();
    }

    private List<SelectedServiceSnapshot> selectedServices(List<BookingCreateRequest.SelectedServiceRequest> requested, int slotCount) {
        Map<String, Integer> quantities = new java.util.LinkedHashMap<>();
        if (requested != null) requested.forEach(item -> {
            if (quantities.containsKey(item.serviceId())) throw new BadRequestException("Không được chọn lặp dịch vụ");
            quantities.put(item.serviceId(), item.quantity());
        });
        List<SelectedServiceSnapshot> selected = new ArrayList<>();
        Set<String> consumed = new HashSet<>();
        List<ServiceItem> catalog = serviceItemRepository.findAll().stream()
                .filter(item -> !Boolean.TRUE.equals(item.getIsDeleted()) && item.getStatus() == ServiceStatus.ACTIVE).toList();
        for (ServiceItem item : catalog) {
            Integer input = quantities.get(item.getId());
            if (!item.isMandatory() && input == null) continue;
            if (item.getUnit() != null && "lần".equalsIgnoreCase(item.getUnit().trim())) continue;
            QuantityRule rule = item.getQuantityRule();
            if (rule == null) rule = switch (item.getCalculationType()) {
                case METERED -> QuantityRule.METERED;
                case PER_SLOT, PER_PERSON -> QuantityRule.PER_SLOT;
                default -> QuantityRule.FIXED_ONE;
            };
            Integer quantity = switch (rule) {
                case METERED -> null;
                case PER_SLOT -> slotCount;
                case FIXED_ONE -> 1;
                case USER_INPUT -> {
                    if (input == null) throw new BadRequestException("Cần nhập số lượng cho dịch vụ " + item.getName());
                    if (input > slotCount) throw new BadRequestException("Số lượng dịch vụ không được vượt số slot đã chọn");
                    if (input == 0 && item.isMandatory()) throw new BadRequestException("Dịch vụ bắt buộc không thể có số lượng bằng 0");
                    yield input;
                }
            };
            consumed.add(item.getId());
            if (quantity != null && quantity == 0) continue;
            SelectedServiceSnapshot snapshot = new SelectedServiceSnapshot();
            snapshot.setServiceId(item.getId());
            snapshot.setName(item.getName());
            snapshot.setUnit(item.getUnit() != null && "người/tháng".equalsIgnoreCase(item.getUnit().trim())
                    ? "slot/tháng" : item.getUnit());
            snapshot.setUnitPrice(item.getUnitPrice());
            snapshot.setCalculationType(item.getCalculationType());
            snapshot.setQuantityRule(rule);
            snapshot.setMandatory(item.isMandatory());
            snapshot.setQuantity(quantity);
            selected.add(snapshot);
        }
        if (!consumed.containsAll(quantities.keySet()))
            throw new BadRequestException("Có dịch vụ không tồn tại hoặc đã ngừng cung cấp");
        return selected;
    }

    private void createTemporaryContract(Booking booking) {
        Contract contract = contractRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).orElseGet(Contract::new);
        if (contract.getId() != null) {
            booking.setContractId(contract.getId());
            return;
        }
        List<RoomSlot> slots = bookingSlotIds(booking).stream().map(this::roomSlot).toList();
        Room room = room(slots.getFirst().getRoomId());
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(booking.getTenantId()).orElse(null);
        contract.setRoomId(room.getId());
        contract.setRoomSlotId(slots.getFirst().getId());
        contract.setRoomSlotIds(bookingSlotIds(booking));
        contract.setBookingId(booking.getId());
        contract.setTenantId(booking.getTenantId());
        contract.setManagerId(room.getManagerId());
        contract.setContractNumber(contractService.nextContractNumber());
        contract.setTenantName(tenant == null ? null : tenant.getFullName());
        contract.setTenantIdNumber(tenant == null ? null : tenant.getIdCardNumber());
        contract.setTenantAddress(tenant == null ? null : tenant.getAddress());
        contract.setRoomAddress((branch == null ? "" : branch.getAddress() + " · ") + room.getRoomNumber());
        contract.setRentPrice((room.getListedRentPrice() == null ? BigDecimal.ZERO : room.getListedRentPrice())
                .multiply(BigDecimal.valueOf(slots.size())));
        contract.setContractDepositAmount(booking.getHoldingDepositAmount());
        contract.setMaxOccupants(slots.size());
        contract.setContractUrl(contractUrl);
        contract.setEvidenceDeadline(clock.instant().plusSeconds(72 * 60 * 60));
        contract.setServices(booking.getSelectedServices().stream().map(service -> {
            ContractServiceSnapshot snapshot = new ContractServiceSnapshot();
            snapshot.setServiceId(service.getServiceId());
            snapshot.setName(service.getName());
            snapshot.setUnit(service.getUnit());
            snapshot.setUnitPrice(service.getUnitPrice());
            snapshot.setCalculationType(service.getCalculationType() == null ? null : service.getCalculationType().name());
            snapshot.setMandatory(service.isMandatory());
            snapshot.setSelected(true);
            snapshot.setQuantity(service.getQuantity());
            return snapshot;
        }).toList());
        contract.setStatus(ContractStatus.DRAFT);
        Contract saved = contractRepository.save(contract);
        booking.setContractId(saved.getId());
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
        occupancy.setStartDate(booking.getExpectedMoveInDate() == null ? LocalDate.now(clock) : booking.getExpectedMoveInDate());
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

    private void updateReservationRange(String bookingId, LocalDate start, LocalDate end) {
        List<RoomSlotOccupancy> reservations = roomSlotOccupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .filter(occupancy -> occupancy.getStatus() == OccupancyStatus.RESERVED).toList();
        if (reservations.isEmpty()) throw new ConflictException("Không tìm thấy reservation của booking trong RoomSlotOccupancy");
        reservations.forEach(occupancy -> {
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

    private Tenant tenant(AuthPrincipal principal) {
        if (principal.email() == null) throw new ForbiddenException("Tài khoản không có email");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElseGet(() -> {
            User user = userRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản Tenant"));
            Tenant created = new Tenant();
            created.setEmail(user.getEmail());
            created.setFullName(user.getFullName());
            created.setPhone(user.getPhone());
            return tenantRepository.save(created);
        });
    }

    private void ensureTenantOwns(Booking booking, AuthPrincipal principal) {
        if (!booking.getTenantId().equals(tenant(principal).getId()))
            throw new ForbiddenException("Bạn không có quyền thao tác booking này");
    }

    private void ensureCanView(Booking booking, AuthPrincipal principal) {
        if (isRole(principal, "TENANT")) ensureTenantOwns(booking, principal);
        else ensureCanManage(booking, principal);
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
        List<RoomSlot> slots = bookingSlotIds(b).stream().map(this::roomSlot).toList();
        RoomSlot slot = slots.getFirst();
        Room room = room(slot.getRoomId());
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(b.getTenantId()).orElse(null);
        User user = tenant == null ? null : userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null);
        return new BookingResponse(b.getId(), b.getTenantId(), b.getRoomSlotId(), slot.getSlotCode(), bookingSlotIds(b), slots.stream().map(RoomSlot::getSlotCode).toList(), b.getExpectedMoveInDate(),
                b.getExpectedMoveOutDate(), b.getHoldingDepositAmount(), b.getPaymentDeadline(), b.getHoldExpiresAt(), b.getCheckInDeadline(), b.getContractId(),
                b.getCancellationPolicy(), b.getDepositStatus(), b.getRejectReason(), b.getStatus(),
                b.getTermsAcceptedAt(), b.getCreatedAt(), b.getUpdatedAt(), user == null ? b.getTenantId() : user.getId(),
                tenant == null ? null : tenant.getFullName(), tenant == null ? null : tenant.getEmail(),
                tenant == null ? null : tenant.getPhone(), room.getRoomNumber(), room.getBranchId(),
                branch == null ? null : branch.getName(), b.getTimeline() == null ? List.of() : List.copyOf(b.getTimeline()),
                b.getSelectedServices() == null ? List.of() : List.copyOf(b.getSelectedServices()));
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
}
