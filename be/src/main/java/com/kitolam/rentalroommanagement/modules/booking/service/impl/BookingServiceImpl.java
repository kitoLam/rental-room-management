package com.kitolam.rentalroommanagement.modules.booking.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.booking.document.BookingTimelineEntry;
import com.kitolam.rentalroommanagement.modules.booking.event.BookingStatusChangedEvent;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingReviewRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingTermsRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.PaymentReconciliationRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingPaymentResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.RoomAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import com.kitolam.rentalroommanagement.modules.booking.repository.BookingRepository;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.kitolam.rentalroommanagement.security.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final ManagerRepository managerRepository;
    private final PaymentRepository paymentRepository;
    private final AppointmentRepository appointmentRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public BookingResponse create(BookingCreateRequest request, AuthPrincipal principal) {
        requireRole(principal, "TENANT");
        expireOverdueBookings();
        Tenant tenant = tenant(principal);
        Room room = room(request.roomId());
        validateRange(request.expectedMoveInDate(), request.expectedMoveOutDate());
        ensureRoomAcceptsBookings(room);
        Booking sameRequest = bookingRepository
                .findByRoomIdAndTenantIdAndExpectedMoveInDateAndExpectedMoveOutDateAndStatusAndIsDeletedFalse(
                        room.getId(), tenant.getId(), request.expectedMoveInDate(), request.expectedMoveOutDate(),
                        BookingStatus.REQUESTED)
                .orElse(null);
        if (sameRequest != null) return response(sameRequest);
        ensureNoOverlap(room.getId(), request.expectedMoveInDate(), request.expectedMoveOutDate(), null);

        Booking booking = new Booking();
        booking.setTenantId(tenant.getId());
        booking.setRoomId(room.getId());
        booking.setExpectedMoveInDate(request.expectedMoveInDate());
        booking.setExpectedMoveOutDate(request.expectedMoveOutDate());
        booking.setStatus(BookingStatus.REQUESTED);
        booking.setDepositStatus(DepositStatus.UNPAID);
        return response(saveTransition(booking, null, "Tenant đã gửi yêu cầu đặt phòng."));
    }

    @Override
    @Transactional
    public RoomAvailabilityResponse checkAvailability(String roomId, LocalDate startDate, LocalDate endDate) {
        expireOverdueBookings();
        validateRange(startDate, endDate);
        Room room = room(roomId);
        boolean operational = room.getStatus() != RoomStatus.MAINTENANCE
                && room.getStatus() != RoomStatus.INACTIVE && room.getStatus() != RoomStatus.OCCUPIED;
        boolean available = operational && !hasOverlappingBooking(roomId, startDate, endDate, null);
        return new RoomAvailabilityResponse(roomId, startDate, endDate, available,
                available ? null : "Phòng đã có booking trùng hoặc hiện không nhận đặt.", List.of());
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
        if (isRole(principal, "TENANT")) {
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", tenant(principal).getId());
        } else if (isRole(principal, "MANAGER")) {
            String branchId = managerRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .orElseThrow(() -> new ForbiddenException("Tài khoản không được gán chi nhánh quản lý"))
                    .getBranchId();
            List<ObjectId> roomIds = roomRepository.findByBranchIdAndIsDeletedFalse(branchId).stream()
                    .map(Room::getId).filter(ObjectId::isValid).map(ObjectId::new).toList();
            criteria.add(Criteria.where("roomId").in(roomIds));
        } else {
            requireRole(principal, "OWNER", "ADMIN");
            MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
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
            return response(saveTransition(booking, previous, "Owner từ chối yêu cầu."));
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
        ensureNoOverlap(booking.getRoomId(), start, end, booking.getId());

        booking.setExpectedMoveInDate(start);
        booking.setExpectedMoveOutDate(end);
        booking.setHoldingDepositAmount(amount);
        booking.setPaymentDeadline(request.paymentDeadline());
        booking.setHoldExpiresAt(request.holdExpiresAt());
        booking.setCancellationPolicy(request.cancellationPolicy().trim());
        booking.setRejectReason(null);
        booking.setStatus(BookingStatus.AWAITING_PAYMENT);
        booking.setDepositStatus(DepositStatus.UNPAID);
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
            return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Tenant không chấp nhận điều khoản."));
        }
        ensureTermsCurrent(booking);
        ensureRoomAcceptsBookings(room(booking.getRoomId()));
        ensureNoOverlap(booking.getRoomId(), booking.getExpectedMoveInDate(), booking.getExpectedMoveOutDate(), booking.getId());
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
        if (booking.getStatus() != BookingStatus.REQUESTED && booking.getStatus() != BookingStatus.AWAITING_PAYMENT)
            throw new ConflictException("Trạng thái hiện tại không cho phép hủy yêu cầu");
        if (paymentRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS))
            throw new ConflictException("Đã nhận thanh toán; vui lòng liên hệ Owner để xử lý hoàn tiền");
        BookingStatus previous = booking.getStatus();
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setTermsAcceptedAt(null);
        Booking saved = saveTransition(booking, previous, "Tenant đã hủy yêu cầu.");
        releaseRoomIfUnused(booking.getRoomId());
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
        if (booking.getStatus() == BookingStatus.EXPIRED && successful) {
            if (!hasOverlappingBooking(booking.getRoomId(), booking.getExpectedMoveInDate(), booking.getExpectedMoveOutDate(), booking.getId())) {
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setDepositStatus(DepositStatus.PAID);
                Room room = room(booking.getRoomId());
                room.setStatus(RoomStatus.RESERVED);
                roomRepository.save(room);
                cancelOverlappingAppointments(booking);
                return response(saveTransition(booking, BookingStatus.EXPIRED, "Thanh toán đến muộn nhưng khoảng thuê vẫn còn trống."));
            }
            booking.setDepositStatus(DepositStatus.PAID);
            Booking saved = bookingRepository.save(booking);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(saved.getId(), saved.getTenantId(),
                    saved.getStatus(), saved.getDepositStatus(), "Khoản cọc đến muộn cần Owner xử lý hoàn tiền."));
            return response(saved);
        }
        if (booking.getStatus() == BookingStatus.EXPIRED) return response(booking);
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT || booking.getTermsAcceptedAt() == null)
            throw new ConflictException("Booking không chờ kết quả thanh toán");
        boolean holdValid = clock.instant().isBefore(booking.getPaymentDeadline())
                && clock.instant().isBefore(booking.getHoldExpiresAt());
        if (!successful) {
            if (!holdValid) {
                expireBooking(booking);
                return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT, "Thanh toán thất bại sau khi hết hạn giữ chỗ."));
            }
            return response(bookingRepository.save(booking));
        }
        boolean roomStillAvailable = !hasOverlappingBooking(booking.getRoomId(), booking.getExpectedMoveInDate(),
                booking.getExpectedMoveOutDate(), booking.getId());
        if (holdValid || roomStillAvailable) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setDepositStatus(DepositStatus.PAID);
            Room room = room(booking.getRoomId());
            room.setStatus(RoomStatus.RESERVED);
            roomRepository.save(room);
            cancelOverlappingAppointments(booking);
        } else {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
        }
        return response(saveTransition(booking, BookingStatus.AWAITING_PAYMENT,
                booking.getStatus() == BookingStatus.CONFIRMED ? "Đã xác minh cọc; booking được xác nhận." : "Phòng đã được giữ; chờ Owner duyệt hoàn cọc."));
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
        List<Booking> overdue = new ArrayList<>(bookingRepository.findByStatusAndHoldExpiresAtLessThanEqualAndIsDeletedFalse(BookingStatus.AWAITING_PAYMENT, now));
        bookingRepository.findByStatusAndPaymentDeadlineLessThanEqualAndIsDeletedFalse(BookingStatus.AWAITING_PAYMENT, now)
                .forEach(b -> { if (overdue.stream().noneMatch(x -> x.getId().equals(b.getId()))) overdue.add(b); });
        for (Booking booking : overdue) {
            BookingStatus previous = booking.getStatus();
            expireBooking(booking);
            saveTransition(booking, previous, "Đã hết hạn thanh toán/giữ chỗ.");
            releaseRoomIfUnused(booking.getRoomId());
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
                || booking.getHoldExpiresAt() == null || !booking.getHoldExpiresAt().isAfter(now)) {
            expireBooking(booking);
            bookingRepository.save(booking);
            throw new ConflictException("Thời hạn giữ chỗ đã hết");
        }
        if (booking.getHoldingDepositAmount() == null || booking.getCancellationPolicy() == null)
            throw new ConflictException("Điều khoản giữ chỗ chưa đầy đủ");
    }

    private void validatePaymentAllowed(Booking booking) {
        if (booking.getStatus() != BookingStatus.AWAITING_PAYMENT || booking.getTermsAcceptedAt() == null)
            throw new ConflictException("Chỉ booking đã chấp nhận điều khoản mới được thanh toán");
        ensureTermsCurrent(booking);
    }

    private void ensureNoOverlap(String roomId, LocalDate start, LocalDate end, String excludeId) {
        if (hasOverlappingBooking(roomId, start, end, excludeId))
            throw new ConflictException("Phòng đã có booking được giữ trong khoảng ngày này");
    }

    private boolean hasOverlappingBooking(String roomId, LocalDate start, LocalDate end, String excludeId) {
        return bookingRepository.findByRoomIdAndStatusInAndExpectedMoveInDateLessThanAndExpectedMoveOutDateGreaterThanAndIsDeletedFalse(
                        roomId, List.of(BookingStatus.AWAITING_PAYMENT, BookingStatus.CONFIRMED), end, start).stream()
                .anyMatch(b -> !b.getId().equals(excludeId)
                        && (b.getStatus() == BookingStatus.CONFIRMED
                        || (b.getTermsAcceptedAt() != null && b.getHoldExpiresAt() != null && b.getHoldExpiresAt().isAfter(clock.instant()))));
    }

    private void releaseRoomIfUnused(String roomId) {
        Room room = room(roomId);
        if (room.getStatus() != RoomStatus.RESERVED) return;
        boolean reserved = bookingRepository.findByRoomIdAndStatusInAndIsDeletedFalse(
                        roomId, List.of(BookingStatus.AWAITING_PAYMENT, BookingStatus.CONFIRMED)).stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.CONFIRMED
                        || (b.getTermsAcceptedAt() != null && b.getHoldExpiresAt() != null && b.getHoldExpiresAt().isAfter(clock.instant())));
        if (!reserved) {
            room.setStatus(RoomStatus.AVAILABLE);
            roomRepository.save(room);
        }
    }

    private void ensureRoomAcceptsBookings(Room room) {
        if (room.getStatus() == RoomStatus.MAINTENANCE || room.getStatus() == RoomStatus.INACTIVE || room.getStatus() == RoomStatus.OCCUPIED)
            throw new ConflictException("Phòng hiện không nhận yêu cầu đặt");
    }

    private void cancelOverlappingAppointments(Booking booking) {
        appointmentRepository.findByRoomIdAndAppointmentDateGreaterThanEqualAndAppointmentDateLessThanAndIsDeletedFalse(
                booking.getRoomId(), booking.getExpectedMoveInDate(), booking.getExpectedMoveOutDate())
                .forEach(appointment -> {
                    if (appointment.getStatus() == AppointmentStatus.PENDING || appointment.getStatus() == AppointmentStatus.CONFIRMED) {
                        appointment.setStatus(AppointmentStatus.CANCELLED);
                        appointmentRepository.save(appointment);
                    }
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
        if (isRole(principal, "OWNER") || isRole(principal, "ADMIN")) return;
        requireRole(principal, "MANAGER");
        String branchId = managerRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new ForbiddenException("Tài khoản không được gán chi nhánh quản lý"))
                .getBranchId();
        if (!room(booking.getRoomId()).getBranchId().equals(branchId))
            throw new ForbiddenException("Booking nằm ngoài chi nhánh được quản lý");
    }

    private boolean isRole(AuthPrincipal principal, String role) {
        return principal != null && role.equals(principal.role());
    }

    private void requireRole(AuthPrincipal principal, String... roles) {
        for (String role : roles) if (isRole(principal, role)) return;
        throw new ForbiddenException("Vai trò hiện tại không được phép thực hiện thao tác này");
    }

    private BookingResponse response(Booking b) {
        Room room = room(b.getRoomId());
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(b.getTenantId()).orElse(null);
        User user = tenant == null ? null : userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null);
        return new BookingResponse(b.getId(), b.getTenantId(), b.getRoomId(), b.getExpectedMoveInDate(),
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
