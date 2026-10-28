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
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository roomSlotOccupancyRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final PaymentRepository paymentRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;
    private final BranchService branchAccess;

    @Override
    public EffectiveRoomHoldResponse currentRoomHold(String roomSlotId) {
        var active = bookingRepository.findByRoomSlotIdAndStatusInAndIsDeletedFalse(roomSlotId,
                List.of(BookingStatus.AWAITING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CONVERTED));
        var official = active.stream().filter(b -> (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.CONVERTED)
                && b.getDepositStatus() == DepositStatus.PAID).map(b -> b.getId()).toList();
        var now = clock.instant();
        boolean temporary = active.stream().anyMatch(b -> b.getStatus() == BookingStatus.AWAITING_PAYMENT
                && b.getTermsAcceptedAt() != null && b.getHoldExpiresAt() != null && b.getHoldExpiresAt().isAfter(now)
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
        RoomSlot roomSlot = claimSlot(request.roomSlotId());
        validateRange(request.expectedMoveInDate(), request.expectedMoveOutDate());
        Booking sameRequest = bookingRepository
                .findByRoomSlotIdAndTenantIdAndExpectedMoveInDateAndExpectedMoveOutDateAndStatusAndIsDeletedFalse(
                        roomSlot.getId(), tenant.getId(), request.expectedMoveInDate(), request.expectedMoveOutDate(),
                        BookingStatus.REQUESTED)
                .orElse(null);
        if (sameRequest != null) return response(sameRequest);
        ensureNoOccupancyOverlap(roomSlot.getId(), request.expectedMoveInDate(), request.expectedMoveOutDate(), null);

        Booking booking = new Booking();
        booking.setTenantId(tenant.getId());
        booking.setRoomSlotId(roomSlot.getId());
        booking.setExpectedMoveInDate(request.expectedMoveInDate());
        booking.setExpectedMoveOutDate(request.expectedMoveOutDate());
        booking.setStatus(BookingStatus.REQUESTED);
        booking.setDepositStatus(DepositStatus.UNPAID);
        Booking saved = saveTransition(booking, null, "Tenant đã gửi yêu cầu đặt phòng.");
        roomSlotOccupancyRepository.save(reservation(saved));
        return response(saved);
    }

    @Override
    @Transactional
    public RoomAvailabilityResponse checkAvailability(String roomSlotId, LocalDate startDate, LocalDate endDate) {
        expireOverdueBookings();
        validateRange(startDate, endDate);
        RoomSlot slot = roomSlot(roomSlotId);
        boolean available = !hasOccupancyOverlap(roomSlotId, startDate, endDate, null);
        return new RoomAvailabilityResponse(roomSlotId, slot.getSlotCode(), startDate, endDate, available,
                available ? null : "Chỗ đã có lượt ở/giữ chỗ trùng hoặc hiện không nhận đặt.");
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
        var blockedSlotIds = overlapping.stream().map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet());

        return ids.stream().map(id -> {
            RoomSlot slot = slots.get(id);
            boolean available = !blockedSlotIds.contains(id);
            return new RoomAvailabilityResponse(id, slot.getSlotCode(), startDate, endDate, available,
                    available ? null : "Chỗ đã có lượt ở/giữ chỗ trùng trong khoảng ngày này.");
        }).toList();
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
        criteria.add(Criteria.where("roomSlotId").exists(true));
        if (isRole(principal, "TENANT")) {
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", tenant(principal).getId());
        } else if (isRole(principal, "MANAGER")) {
            String branchId = managerBranch(principal);
            List<String> roomIds = roomRepository.findByBranchIdAndIsDeletedFalse(branchId).stream().map(Room::getId).toList();
            List<ObjectId> roomSlotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(roomIds).stream()
                    .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            criteria.add(Criteria.where("roomSlotId").in(roomSlotIds));
        } else {
            requireRole(principal, "OWNER", "ADMIN");
            if (isRole(principal, "OWNER")) {
                var branches = branchAccess.ownedBranchIds(principal.userId());
                var ownedRoomIds = roomRepository.findByBranchIdInAndIsDeletedFalse(branches).stream()
                        .map(Room::getId).toList();
                var ownedRoomSlotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(ownedRoomIds).stream()
                        .map(RoomSlot::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
                criteria.add(Criteria.where("roomSlotId").in(ownedRoomSlotIds));
            }
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "roomSlotId", filter.roomSlotId());
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
            claimSlot(booking.getRoomSlotId());
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
        claimSlot(booking.getRoomSlotId());
        ensureNoOccupancyOverlap(booking.getRoomSlotId(), start, end, booking.getId());

        booking.setExpectedMoveInDate(start);
        booking.setExpectedMoveOutDate(end);
        booking.setHoldingDepositAmount(amount);
        booking.setPaymentDeadline(request.paymentDeadline());
        booking.setHoldExpiresAt(request.holdExpiresAt());
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
            claimSlot(booking.getRoomSlotId());
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
        claimSlot(booking.getRoomSlotId());
        if (booking.getStatus() != BookingStatus.REQUESTED && booking.getStatus() != BookingStatus.AWAITING_PAYMENT)
            throw new ConflictException("Trạng thái hiện tại không cho phép hủy yêu cầu");
        if (paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS))
            throw new ConflictException("Đã nhận thanh toán; vui lòng liên hệ Owner để xử lý hoàn tiền");
        BookingStatus previous = booking.getStatus();
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setTermsAcceptedAt(null);
        Booking saved = saveTransition(booking, previous, "Tenant đã hủy yêu cầu.");
        releaseReservation(saved.getId());
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
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT || booking.getTermsAcceptedAt() == null)
            throw new ConflictException("Booking không chờ kết quả thanh toán");
        boolean holdValid = clock.instant().isBefore(booking.getPaymentDeadline())
                && clock.instant().isBefore(booking.getHoldExpiresAt());
        if (!successful) {
            if (!holdValid) {
                claimSlot(booking.getRoomSlotId());
                expireBooking(booking);
                Booking saved = saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Thanh toán thất bại sau khi hết hạn giữ chỗ.");
                releaseReservation(saved.getId());
                return response(saved);
            }
            return response(bookingRepository.save(booking));
        }
        claimSlot(booking.getRoomSlotId());
        if (holdValid && hasReservation(booking.getId())) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setDepositStatus(DepositStatus.PAID);
        } else {
            releaseReservation(booking.getId());
            if (!hasOccupancyOverlap(booking.getRoomSlotId(), booking.getExpectedMoveInDate(), booking.getExpectedMoveOutDate(), booking.getId())) {
                roomSlotOccupancyRepository.save(reservation(booking));
                booking.setStatus(BookingStatus.CONFIRMED);
            } else {
                booking.setStatus(BookingStatus.EXPIRED);
            }
            booking.setDepositStatus(DepositStatus.PAID);
        }
        return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                booking.getStatus() == BookingStatus.CONFIRMED ? "Đã xác minh cọc; booking được xác nhận."
                        : "Slot đã được giữ; chờ Owner duyệt hoàn cọc."));
    }

    private BookingResponse processLatePayment(Booking booking) {
        claimSlot(booking.getRoomSlotId());
        releaseReservation(booking.getId());
        booking.setDepositStatus(DepositStatus.PAID);
        if (!hasOccupancyOverlap(booking.getRoomSlotId(), booking.getExpectedMoveInDate(), booking.getExpectedMoveOutDate(), booking.getId())) {
            roomSlotOccupancyRepository.save(reservation(booking));
            booking.setStatus(BookingStatus.CONFIRMED);
            return response(saveTransition(booking, BookingStatus.EXPIRED, "Thanh toán đến muộn nhưng slot vẫn còn trống."));
        }
        Booking saved = bookingRepository.save(booking);
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
        if (booking.getStatus() != BookingStatus.EXPIRED || booking.getDepositStatus() != DepositStatus.PAID)
            throw new ConflictException("Chỉ tiền cọc của booking hết hạn mới chờ duyệt hoàn");
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
            claimSlot(booking.getRoomSlotId());
            expireBooking(booking);
            saveTransition(booking, previous, "Đã hết hạn thanh toán/giữ chỗ.");
            releaseReservation(booking.getId());
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
        if (booking.getHoldingDepositAmount() == null || booking.getCancellationPolicy() == null)
            throw new ConflictException("Điều khoản giữ chỗ chưa đầy đủ");
    }

    private void validatePaymentAllowed(Booking booking) {
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT || booking.getTermsAcceptedAt() == null)
            throw new ConflictException("Chỉ booking đã chấp nhận điều khoản mới được thanh toán");
        ensureTermsCurrent(booking);
        requireReservation(booking.getId());
    }

    private void ensureNoOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        if (hasOccupancyOverlap(roomSlotId, start, end, excludeBookingId))
            throw new ConflictException("Slot đã có lượt ở/giữ chỗ trùng trong khoảng ngày này");
    }

    private boolean hasOccupancyOverlap(String roomSlotId, LocalDate start, LocalDate end, String excludeBookingId) {
        List<OccupancyStatus> blockingStatuses = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
        List<RoomSlotOccupancy> overlapping = new ArrayList<>(roomSlotOccupancyRepository
                .findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateGreaterThanAndIsDeletedFalse(
                        roomSlotId, blockingStatuses, end, start));
        overlapping.addAll(roomSlotOccupancyRepository
                .findByRoomSlotIdAndStatusInAndStartDateLessThanAndEndDateIsNullAndIsDeletedFalse(
                        roomSlotId, blockingStatuses, end));
        return overlapping.stream().anyMatch(occupancy -> excludeBookingId == null
                || !excludeBookingId.equals(occupancy.getBookingId()));
    }

    private RoomSlot claimSlot(String roomSlotId) {
        RoomSlot slot = roomSlot(roomSlotId);
        try {
            return roomSlotRepository.save(slot);
        } catch (OptimisticLockingFailureException exception) {
            throw new ConflictException("Slot vừa được cập nhật bởi yêu cầu khác; vui lòng thử lại");
        }
    }

    private RoomSlotOccupancy reservation(Booking booking) {
        RoomSlotOccupancy occupancy = new RoomSlotOccupancy();
        occupancy.setRoomSlotId(booking.getRoomSlotId());
        occupancy.setBookingId(booking.getId());
        occupancy.setStartDate(booking.getExpectedMoveInDate());
        occupancy.setEndDate(booking.getExpectedMoveOutDate());
        occupancy.setStatus(OccupancyStatus.RESERVED);
        return occupancy;
    }

    private boolean hasReservation(String bookingId) {
        return roomSlotOccupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .anyMatch(occupancy -> occupancy.getStatus() == OccupancyStatus.RESERVED);
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
        branchAccess.requireManagementAccess(room(roomSlot(booking.getRoomSlotId()).getRoomId()).getBranchId(), principal);
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
        RoomSlot slot = roomSlot(b.getRoomSlotId());
        Room room = room(slot.getRoomId());
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(b.getTenantId()).orElse(null);
        User user = tenant == null ? null : userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null);
        return new BookingResponse(b.getId(), b.getTenantId(), b.getRoomSlotId(), slot.getSlotCode(), b.getExpectedMoveInDate(),
                b.getExpectedMoveOutDate(), b.getHoldingDepositAmount(), b.getPaymentDeadline(), b.getHoldExpiresAt(),
                b.getCancellationPolicy(), b.getDepositStatus(), b.getRejectReason(), b.getStatus(),
                b.getTermsAcceptedAt(), b.getCreatedAt(), b.getUpdatedAt(), user == null ? b.getTenantId() : user.getId(),
                tenant == null ? null : tenant.getFullName(), tenant == null ? null : tenant.getEmail(),
                tenant == null ? null : tenant.getPhone(), room.getRoomNumber(), room.getBranchId(),
                branch == null ? null : branch.getName(), b.getTimeline() == null ? List.of() : List.copyOf(b.getTimeline()));
    }

    private BookingPaymentResponse paymentResponse(Payment p, String paymentUrl) {
        return new BookingPaymentResponse(p.getId(), p.getBookingId(), p.getAmount(), p.getTransactionCode(),
                p.getMethod(), p.getStatus(), p.getCreatedAt(), p.getPaidAt(), paymentUrl);
    }
}
