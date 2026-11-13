package com.kitolam.rentalroommanagement.modules.contract.service.impl;

import com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.booking.document.BookingTimelineEntry;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import com.kitolam.rentalroommanagement.modules.booking.event.BookingStatusChangedEvent;
import com.kitolam.rentalroommanagement.modules.booking.repository.BookingRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractEvidenceHistoryEntry;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceReviewRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractTemplateService;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.kitolam.rentalroommanagement.modules.upload.service.CloudinaryService;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.dao.OptimisticLockingFailureException;
import org.bson.types.ObjectId;
import org.bson.Document;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContractServiceImpl implements ContractService {

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ContractRepository contractRepository;
    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository occupancyRepository;
    private final com.kitolam.rentalroommanagement.modules.roomslotoccupancy.support.RoomSlotOccupancySupport occupancySupport;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final BranchRepository branchRepository;
    private final BranchService branchAccess;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;
    private final ContractTemplateService contractTemplates;
    private final CloudinaryService cloudinary;

    @Scheduled(fixedDelayString = "${booking.automation.delay-ms:30000}", initialDelayString = "${booking.automation.initial-delay-ms:10000}")
    @Transactional
    public void expireEvidenceRequests() {
        Instant now = clock.instant();
        contractRepository.findByStatusAndEvidenceDeadlineLessThanEqualAndIsDeletedFalse(ContractStatus.DRAFT, now)
                .stream().filter(contract -> contract.getEvidenceSubmittedAt() == null)
                .forEach(this::expireEvidenceContract);
    }

    @Override
    @Transactional
    public ContractResponse selectServices(String id, ContractServiceSelectionRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        requireTenant(contract, principal);
        if (contract.getStatus() != ContractStatus.DRAFT)
            throw new ConflictException("Chỉ được chọn dịch vụ khi hợp đồng còn ở trạng thái nháp");
        List<String> selectedIds = request.selectedServiceIds() == null ? List.of() : request.selectedServiceIds();
        List<ContractServiceSnapshot> services = contract.getServices() == null ? new ArrayList<>() : contract.getServices();
        for (String requested : selectedIds) {
            if (services.stream().noneMatch(s -> s.getServiceId().equals(requested)))
                throw new BadRequestException("Dịch vụ được chọn không nằm trong snapshot hợp đồng");
        }
        services.forEach(service -> service.setSelected(service.isMandatory() || selectedIds.contains(service.getServiceId())));
        contract.setServices(services);
        if (contract.getPdfRevision() != null) {
            if (contract.getEvidenceSubmittedAt() != null)
                throw new ConflictException("Hợp đồng đã nộp bằng chứng.");
            contractTemplates.queuePdf(contract);
        }
        return response(contractRepository.save(contract));
    }

    @Override
    @Transactional
    public ContractResponse chooseTerm(String id, int termMonths, AuthPrincipal principal) {
        Contract contract = find(id);
        requireTenant(contract, principal);
        validateTerm(termMonths);
        if (contract.getPdfRevision() == null || contract.getStatus() != ContractStatus.DRAFT
                || contract.getEvidenceSubmittedAt() != null || contract.getEvidenceDeadline() == null
                || !contract.getEvidenceDeadline().isAfter(clock.instant())) {
            throw new ConflictException("Hợp đồng hiện không thể chọn kỳ hạn.");
        }
        if (Integer.valueOf(termMonths).equals(contract.getTermMonths())) return response(contract);
        if (contract.getTermMonths() != null) throw new ConflictException("Kỳ hạn đã được chốt.");
        if (contract.getStartDate() == null) throw new ConflictException("Hợp đồng chưa có ngày bắt đầu thuê.");
        contract.setTermMonths(termMonths);
        contract.setEndDate(contract.getStartDate().plusMonths(termMonths));
        contractTemplates.queuePdf(contract);
        return response(contractRepository.save(contract));
    }

    @Override
    public String downloadPdf(String id, AuthPrincipal principal) {
        Contract contract = find(id);
        if (principal != null && "TENANT".equals(principal.role())) {
            requireTenant(contract, principal);
            if (contract.getTermMonths() == null)
                throw new ConflictException("Hãy chọn kỳ hạn trước khi tải hợp đồng.");
        } else {
            requireManager(room(contract.getRoomId()), principal);
        }
        if (contract.getPdfPublicId() == null || contract.getContractUrl() == null)
            throw new ConflictException("PDF hợp đồng chưa sẵn sàng.");
        return cloudinary.contractDownloadUrl(contract.getPdfPublicId(), clock.instant().plusSeconds(120).getEpochSecond());
    }

    @Override
    public String downloadSignedEvidence(String id, AuthPrincipal principal) {
        Contract contract = find(id);
        requireManager(room(contract.getRoomId()), principal);
        String evidence = contract.getSignedEvidenceUrl();
        if (evidence == null || evidence.isBlank()) {
            throw new NotFoundException("Hợp đồng chưa có bản ký do người thuê gửi.");
        }
        return cloudinary.contractEvidenceDownloadUrl(evidence, clock.instant().plusSeconds(120).getEpochSecond());
    }

    private void validateTerm(int termMonths) {
        if (!List.of(3, 6, 8, 12).contains(termMonths))
            throw new BadRequestException("Kỳ hạn hợp đồng chỉ gồm 3, 6, 8 hoặc 12 tháng");
    }

    @Override
    @Transactional
    public ContractResponse completeCheckIn(String id, ContractCheckInRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        Booking booking = booking(contract.getBookingId());
        if (booking.getSlotMoveInDates() != null)
            throw new ConflictException("Đơn đặt chỗ này cần nộp và duyệt bằng chứng hợp đồng.");
        RoomSlot slot = slot(contract.getRoomSlotId());
        Room room = room(slot.getRoomId());
        requireManager(room, principal);
        try {
            roomSlotRepository.save(slot);
        } catch (OptimisticLockingFailureException exception) {
            throw new ConflictException("Slot vừa được cập nhật bởi yêu cầu khác; vui lòng tải lại");
        }
        if (contract.getStatus() != ContractStatus.DRAFT || booking.getStatus() != BookingStatus.CONFIRMED
                || booking.getDepositStatus() != DepositStatus.PAID)
            throw new ConflictException("Hợp đồng hoặc booking không ở trạng thái cho phép bàn giao");
        if (booking.getExpectedMoveInDate() == null)
            throw new ConflictException("Hợp đồng mới cần nộp và duyệt bằng chứng chữ ký trước khi kích hoạt");
        if (booking.getCheckInDeadline() == null || !booking.getCheckInDeadline().isAfter(clock.instant()))
            throw new ConflictException("Đã quá hạn check-in của booking");
        if (contract.getServices() != null && contract.getServices().stream().anyMatch(s -> s.isMandatory() && !s.isSelected()))
            throw new ConflictException("Hợp đồng chưa có đủ dịch vụ bắt buộc");
        ContractTenant contractTenant = contractTenantRepository.findByContractIdAndIsDeletedFalse(contract.getId()).stream()
                .findFirst()
                .orElseGet(() -> {
                    ContractTenant created = new ContractTenant();
                    created.setContractId(contract.getId());
                    created.setTenantId(booking.getTenantId());
                    created.setBookingId(booking.getId());
                    created.setIsRepresentative(true);
                    created.setRentAmount(contract.getRentPrice());
                    created.setJoinedAt(booking.getExpectedMoveInDate());
                    created.setRoomSlotIds(contract.getRoomSlotIds());
                    created.setServices(contract.getServices());
                    created.setStatus(ContractTenantStatus.ACTIVE);
                    return contractTenantRepository.save(created);
                });
        RoomSlotOccupancy occupancy = occupancyRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                .filter(item -> item.getRoomSlotId().equals(slot.getId()) && item.getStatus() == OccupancyStatus.RESERVED)
                .findFirst().orElseThrow(() -> new ConflictException("Không tìm thấy slot đang được giữ bởi booking"));
        occupancy.setContractTenantId(contractTenant.getId());
        occupancy.setStatus(OccupancyStatus.ACTIVE);
        occupancyRepository.save(occupancy);
        contract.setSignedFileUrl(request.signedFileUrl().trim());
        contract.setStatus(ContractStatus.ACTIVE);
        activateBookedServices(contract, booking.getExpectedMoveInDate());
        Contract saved = contractRepository.save(contract);
        convertBookingWhenAllActive(booking, "Đã bàn giao phòng và lưu hợp đồng đã ký giấy.");
        refreshRoomStatus(room);
        eventPublisher.publishEvent(new BookingStatusChangedEvent(booking.getId(), booking.getTenantId(),
                booking.getStatus(), booking.getDepositStatus(), "Bàn giao phòng hoàn tất."));
        return response(saved);
    }

    @Override
    @Transactional
    public ContractResponse submitEvidence(String id, ContractEvidenceRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        requireTenant(contract, principal);
        if (contract.getStatus() != ContractStatus.DRAFT || contract.getBookingId() == null)
            throw new ConflictException("Chỉ hợp đồng tạm đang chờ bằng chứng mới nhận hồ sơ");
        Instant now = clock.instant();
        if (contract.getEvidenceDeadline() == null || !contract.getEvidenceDeadline().isAfter(now))
            throw new ConflictException("Hạn nộp bằng chứng hợp đồng đã hết");
        validateTerm(request.termMonths());
        if (contract.getPdfRevision() != null && (contract.getContractUrl() == null || contract.getPdfPublicId() == null
                || !request.termMonths().equals(contract.getTermMonths())))
            throw new ConflictException("Hãy chốt kỳ hạn và tải bản PDF tương ứng trước khi gửi bằng chứng.");
        contract.setSignedEvidenceUrl(request.evidenceUrl().trim());
        contract.setTermMonths(request.termMonths());
        contract.setSignedDate(null);
        if (contract.getPdfRevision() == null) {
            if (booking(contract.getBookingId()).getSlotMoveInDates() == null) contract.setStartDate(null);
            contract.setEndDate(null);
        }
        contract.setEvidenceSubmittedAt(now);
        contract.setEvidenceDeadline(null);
        contract.setEvidenceNote(null);
        addEvidenceHistory(contract, "SUBMITTED", now, null);
        return response(contractRepository.save(contract));
    }

    @Override
    @Transactional
    public ContractResponse reviewEvidence(String id, ContractEvidenceReviewRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        requireManager(room(contract.getRoomId()), principal);
        Booking booking = booking(contract.getBookingId());
        if (contract.getStatus() != ContractStatus.DRAFT || contract.getEvidenceSubmittedAt() == null)
            throw new ConflictException("Hợp đồng chưa có bằng chứng đang chờ duyệt");
        if (!request.approved()) {
            String note = request.note() == null ? "" : request.note().trim();
            if (note.isBlank()) throw new BadRequestException("Cần ghi rõ lý do yêu cầu gửi lại bằng chứng");
            addEvidenceHistory(contract, "RESUBMISSION_REQUESTED", clock.instant(), note);
            int resubmissions = contract.getEvidenceResubmissionCount() == null ? 0 : contract.getEvidenceResubmissionCount();
            if (resubmissions >= 2) {
                expireEvidenceContract(contract);
                return response(contractRepository.findByIdAndIsDeletedFalse(id).orElse(contract));
            }
            contract.setEvidenceResubmissionCount(resubmissions + 1);
            contract.setSignedEvidenceUrl(null);
            contract.setEvidenceSubmittedAt(null);
            contract.setTermMonths(null);
            contract.setSignedDate(null);
            if (booking.getSlotMoveInDates() == null) contract.setStartDate(null);
            contract.setEndDate(null);
            if (contract.getPdfRevision() != null) {
                if (contract.getStartDate() == null) contract.setStartDate(booking.getExpectedMoveInDate());
                contractTemplates.queuePdf(contract);
            }
            contract.setEvidenceDeadline(clock.instant().plusSeconds(24 * 60 * 60));
            contract.setEvidenceNote(note);
            return response(contractRepository.save(contract));
        }

        // Ngày bắt đầu hợp đồng theo ngày bắt đầu thuê đã chốt lúc đặt cọc; booking cũ chưa có thì giữ quy tắc cũ.
        LocalDate effectiveDate = contract.getStartDate();
        if (contract.getPdfRevision() == null) {
            effectiveDate = booking.getSlotMoveInDates() == null
                    ? booking.getExpectedMoveInDate()
                    : booking.getSlotMoveInDates().get(contract.getRoomSlotId());
        }
        if (effectiveDate == null)
            effectiveDate = LocalDate.ofInstant(contract.getEvidenceSubmittedAt(), VIETNAM_ZONE).plusDays(1);
        LocalDate firstBillingStartDate = effectiveDate.withDayOfMonth(1).plusMonths(1);
        if (!firstBillingStartDate.equals(request.firstBillingStartDate()))
            throw new BadRequestException("Ngày tính tiền kỳ đầu phải là mùng 1 tháng sau ngày bắt đầu thuê.");
        LocalDate contractStart = effectiveDate;
        contract.setSignedDate(null);
        contract.setStartDate(effectiveDate);
        contract.setEndDate(effectiveDate.plusMonths(contract.getTermMonths()));
        contract.setFirstBillingStartDate(firstBillingStartDate);
        contract.setSignedFileUrl(contract.getSignedEvidenceUrl());
        contract.setStatus(ContractStatus.ACTIVE);
        addEvidenceHistory(contract, "APPROVED", clock.instant(), null);
        ContractTenant contractTenant = contractTenantRepository.findByContractIdAndIsDeletedFalse(contract.getId()).stream()
                .findFirst()
                .orElseGet(() -> {
                    ContractTenant created = new ContractTenant();
                    created.setContractId(contract.getId());
                    created.setTenantId(booking.getTenantId());
                    created.setBookingId(booking.getId());
                    created.setIsRepresentative(true);
                    created.setRentAmount(contract.getRentPrice());
                    created.setJoinedAt(contractStart);
                    created.setRoomSlotIds(contract.getRoomSlotIds());
                    created.setServices(contract.getServices());
                    created.setStatus(ContractTenantStatus.ACTIVE);
                    return contractTenantRepository.save(created);
                });
        // Only the slot(s) of this contract; the other contracts of the booking keep their reservation.
        List<RoomSlotOccupancy> reservations = occupancyRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                .filter(item -> item.getStatus() == OccupancyStatus.RESERVED)
                .filter(item -> contract.getRoomSlotIds().contains(item.getRoomSlotId()))
                .toList();
        if (reservations.size() != contract.getRoomSlotIds().size())
            throw new ConflictException("Không tìm thấy đủ slot đang được giữ bởi booking");
        reservations.forEach(item -> {
            item.setContractTenantId(contractTenant.getId());
            item.setStartDate(contractStart);
            item.setEndDate(contract.getEndDate());
            item.setStatus(OccupancyStatus.ACTIVE);
            occupancyRepository.save(item);
        });
        contract.setMaxOccupants(contract.getRoomSlotIds().size());
        activateBookedServices(contract, effectiveDate);
        Contract saved = contractRepository.save(contract);
        convertBookingWhenAllActive(booking, "Manager đã duyệt bằng chứng hợp đồng " + contract.getContractNumber() + ".");
        refreshRoomStatus(room(contract.getRoomId()));
        eventPublisher.publishEvent(new BookingStatusChangedEvent(booking.getId(), booking.getTenantId(), booking.getStatus(),
                booking.getDepositStatus(), "Bằng chứng hợp đồng đã được duyệt; tenancy đã kích hoạt."));
        return response(saved);
    }

    @Override
    @Transactional
    public ContractResponse renew(String id, com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractRenewRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        requireManager(room(contract.getRoomId()), principal);
        Integer termMonths = request.termMonths();
        if (!List.of(3, 6, 8, 12).contains(termMonths))
            throw new BadRequestException("Kỳ hạn hợp đồng chỉ gồm 3, 6, 8 hoặc 12 tháng");
        if (contract.getStatus() != ContractStatus.ACTIVE)
            throw new ConflictException("Chỉ hợp đồng đang hiệu lực mới gia hạn được");
        if (contract.getEndDate() == null)
            throw new ConflictException("Hợp đồng chưa có ngày kết thúc để gia hạn");
        if (contract.getEndDate().isBefore(LocalDate.ofInstant(clock.instant(), VIETNAM_ZONE)))
            throw new ConflictException("Hợp đồng đã hết hạn");
        if (contract.getRenewedToContractId() != null)
            throw new ConflictException("Hợp đồng này đã được gia hạn");
        // Booking and renewal both write the slot version before checking occupancy.
        try {
            roomSlotRepository.save(slot(contract.getRoomSlotId()));
        } catch (OptimisticLockingFailureException exception) {
            throw new ConflictException("Slot vừa được cập nhật bởi yêu cầu khác; vui lòng tải lại");
        }
        LocalDate newStart = contract.getEndDate().plusDays(1);
        LocalDate newEnd = newStart.plusMonths(termMonths);
        if (hasLaterClaimOnSlot(contract, newStart, newEnd))
            throw new ConflictException("Chỗ ở đã có người đặt sau hợp đồng này, không thể gia hạn");

        Contract renewal = copyForRenewal(contract, newStart, newEnd);
        renewal.setTermMonths(termMonths);
        String renewalId = renewal.getId();
        // Atomic claim: chỉ một request chuyển được renewedToContractId từ null -> renewalId.
        Contract claimed = mongoTemplate.findAndModify(
                Query.query(Criteria.where("_id").is(new ObjectId(id))
                        .and("status").is(ContractStatus.ACTIVE).and("renewedToContractId").is(null)),
                new Update().set("renewedToContractId", renewalId).set("updatedAt", clock.instant()),
                FindAndModifyOptions.options().returnNew(true), Contract.class);
        if (claimed == null) throw new ConflictException("Hợp đồng này đã được gia hạn");
        // Re-check sau khi claim để chặn race với đặt cọc đồng thời.
        if (hasLaterClaimOnSlot(contract, newStart, newEnd)) {
            mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(new ObjectId(id))),
                    new Update().set("renewedToContractId", null), Contract.class);
            throw new ConflictException("Chỗ ở đã có người đặt sau hợp đồng này, không thể gia hạn");
        }
        contractRepository.save(renewal);
        // Kéo dài lượt ở hiện tại của slot để không bị nhả cho người mới.
        occupancySupport.extendForContract(contract, newEnd);
        ContractTenant contractTenant = new ContractTenant();
        contractTenant.setContractId(renewalId);
        contractTenant.setTenantId(renewal.getTenantId());
        contractTenant.setBookingId(renewal.getBookingId());
        contractTenant.setIsRepresentative(true);
        contractTenant.setRentAmount(renewal.getRentPrice());
        contractTenant.setJoinedAt(newStart);
        contractTenant.setRoomSlotIds(renewal.getRoomSlotIds());
        contractTenant.setServices(renewal.getServices());
        contractTenant.setStatus(ContractTenantStatus.ACTIVE);
        contractTenantRepository.save(contractTenant);
        return response(renewal);
    }

    private boolean hasLaterClaimOnSlot(Contract contract, LocalDate newStart, LocalDate newEnd) {
        String slotId = contract.getRoomSlotId();
        for (RoomSlotOccupancy occupancy : occupancyRepository.findByRoomSlotIdAndStatusInAndIsDeletedFalse(
                slotId, List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE))) {
            if (occupancy.getStatus() == OccupancyStatus.RESERVED && occupancy.getBookingId() != null) {
                Booking holder = bookingRepository.findByIdAndIsDeletedFalse(occupancy.getBookingId()).orElse(null);
                if (holder != null && holder.getStatus() == BookingStatus.AWAITING_PAYMENT
                        && ((holder.getHoldExpiresAt() != null && !holder.getHoldExpiresAt().isAfter(clock.instant()))
                        || (holder.getPaymentDeadline() != null && !holder.getPaymentDeadline().isAfter(clock.instant()))))
                    continue;
            }
            if ((occupancy.getEndDate() == null || !occupancy.getEndDate().isBefore(newStart))
                    && (occupancy.getStartDate() == null || !occupancy.getStartDate().isAfter(newEnd)))
                return true;
        }
        return false;
    }

    /** Nhân bản dữ liệu hợp đồng cũ thành hợp đồng nối tiếp ACTIVE cho cùng slot. */
    private Contract copyForRenewal(Contract old, LocalDate newStart, LocalDate newEnd) {
        Contract c = new Contract();
        c.setBookingId(old.getBookingId());
        c.setRoomId(old.getRoomId());
        c.setRoomSlotId(old.getRoomSlotId());
        c.setRoomSlotIds(old.getRoomSlotIds() == null ? new ArrayList<>() : new ArrayList<>(old.getRoomSlotIds()));
        c.setTenantId(old.getTenantId());
        c.setManagerId(old.getManagerId());
        c.setContractNumber(nextContractNumber());
        c.setStartDate(newStart);
        c.setEndDate(newEnd);
        c.setRentPrice(old.getRentPrice());
        c.setContractDepositAmount(old.getContractDepositAmount());
        c.setPaymentDueDay(old.getPaymentDueDay());
        c.setTerms(old.getTerms());
        c.setLandlordName(old.getLandlordName());
        c.setLandlordIdNumber(old.getLandlordIdNumber());
        c.setLandlordAddress(old.getLandlordAddress());
        c.setTenantName(old.getTenantName());
        c.setTenantIdNumber(old.getTenantIdNumber());
        c.setTenantAddress(old.getTenantAddress());
        c.setRoomAddress(old.getRoomAddress());
        c.setMaxOccupants(old.getMaxOccupants());
        c.setTerms(old.getTerms());
        c.setServices(old.getServices() == null ? new ArrayList<>() : new ArrayList<>(old.getServices()));
        c.setActiveSlotServices(new ArrayList<>());
        if (old.getPdfRevision() == null) c.setContractUrl(old.getContractUrl());
        c.setFirstBillingStartDate(null);
        c.setStatus(ContractStatus.ACTIVE);
        c.setRenewedFromContractId(old.getId());
        c.setId(new ObjectId().toHexString());
        return c;
    }

    /** Booking becomes CONVERTED only when every one of its (non-terminated) contracts is ACTIVE. */
    private void convertBookingWhenAllActive(Booking booking, String note) {
        List<Contract> contracts = contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId());
        boolean allActive = contracts.stream()
                .filter(item -> item.getStatus() != ContractStatus.TERMINATED)
                .allMatch(item -> item.getStatus() == ContractStatus.ACTIVE);
        if (booking.getTimeline() == null) booking.setTimeline(new ArrayList<>());
        if (allActive) booking.setStatus(BookingStatus.CONVERTED);
        booking.getTimeline().add(new BookingTimelineEntry(booking.getStatus().name(), clock.instant(), note));
        bookingRepository.save(booking);
    }

    /** Optional services picked while booking start being used on the day the contract takes effect. */
    private void activateBookedServices(Contract contract, LocalDate startDate) {
        if (contract.getServices() == null || startDate == null) return;
        if (contract.getActiveSlotServices() == null) contract.setActiveSlotServices(new ArrayList<>());
        contract.getServices().stream()
                .filter(service -> service.isSelected() && !service.isMandatory())
                .filter(service -> contract.getActiveSlotServices().stream().noneMatch(a -> a.getSlotServiceId().equals(service.getServiceId())))
                .forEach(service -> {
                    var active = new com.kitolam.rentalroommanagement.modules.contract.document.ActiveSlotService();
                    active.setSlotServiceId(service.getServiceId());
                    active.setName(service.getName());
                    active.setUnit(service.getUnit());
                    active.setUnitPrice(service.getUnitPrice());
                    active.setQuantity(service.getQuantity() == null ? 1 : service.getQuantity());
                    active.setStartDate(startDate);
                    contract.getActiveSlotServices().add(active);
                });
    }

    private void expireEvidenceContract(Contract contract) {
        Booking booking = booking(contract.getBookingId());
        addEvidenceHistory(contract, "EXPIRED", clock.instant(), "Hạn nộp bằng chứng hợp đồng đã hết.");
        contract.setStatus(ContractStatus.TERMINATED);
        contract.setTerminatedAt(clock.instant());
        contract.setTerminationReason("Quá hạn nộp bằng chứng hợp đồng; slot được trả lại và tiền cọc của slot chờ hoàn.");
        contract.setEvidenceDeadline(null);
        contractRepository.save(contract);
        // Release only this contract's slot; the booking expires once none of its contracts is left.
        occupancyRepository.findByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                .filter(item -> item.getStatus() == OccupancyStatus.RESERVED)
                .filter(item -> contract.getRoomSlotIds().contains(item.getRoomSlotId()))
                .forEach(item -> {
                    item.setStatus(OccupancyStatus.ENDED);
                    occupancyRepository.save(item);
                });
        boolean allTerminated = contractRepository.findAllByBookingIdAndIsDeletedFalse(booking.getId()).stream()
                .allMatch(item -> item.getStatus() == ContractStatus.TERMINATED);
        if (booking.getTimeline() == null) booking.setTimeline(new ArrayList<>());
        if (allTerminated) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setDepositStatus(DepositStatus.PAID);
            booking.getTimeline().add(new BookingTimelineEntry(BookingStatus.EXPIRED.name(), clock.instant(), contract.getTerminationReason()));
        } else {
            booking.getTimeline().add(new BookingTimelineEntry(booking.getStatus().name(), clock.instant(),
                    "Hợp đồng " + contract.getContractNumber() + " hết hạn nộp bằng chứng; các hợp đồng khác vẫn tiếp tục."));
        }
        bookingRepository.save(booking);
        eventPublisher.publishEvent(new BookingStatusChangedEvent(booking.getId(), booking.getTenantId(), booking.getStatus(),
                booking.getDepositStatus(), "Hạn nộp bằng chứng hợp đồng đã hết; cần xử lý hoàn cọc."));
    }

    @Override
    public ContractResponse create(ContractCreateRequest request) {
        throw new ConflictException("Hợp đồng phải được tạo từ booking đã xác nhận và nộp cọc");
    }

    @Override
    public ContractResponse getById(String id, AuthPrincipal principal) {
        Contract contract = find(id);
        if (principal != null && "TENANT".equals(principal.role())) {
            requireTenant(contract, principal);
            return response(contract);
        }
        Room contractRoom = room(contract.getRoomId());
        requireManager(contractRoom, principal);
        return response(contract, roomName(contractRoom));
    }

    @Override
    public PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        if (principal == null || !List.of("TENANT", "OWNER", "MANAGER", "ADMIN").contains(principal.role()))
            throw new ForbiddenException("Không có quyền tìm kiếm hợp đồng");
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("status").ne(ContractStatus.TEMPLATE));
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addObjectIdEquals(criteria, "managerId", filter.managerId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "contractNumber", "tenantName", "landlordName");
        if ("TENANT".equals(principal.role())) {
            Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
            if (tenant == null) {
                return PagedResponse.from(org.springframework.data.domain.Page.<Contract>empty(pageable), this::response);
            }
            List<Criteria> ownership = new ArrayList<>();
            ownership.add(new Criteria().orOperator(
                    Criteria.where("tenantId").is(MongoQueryHelper.toObjectId(tenant.getId())),
                    Criteria.where("tenantId").is(tenant.getId())));
            List<ObjectId> memberContractIds = contractTenantRepository.findByTenantIdAndIsDeletedFalse(tenant.getId()).stream()
                    .map(com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant::getContractId)
                    .filter(ObjectId::isValid).map(ObjectId::new).toList();
            if (!memberContractIds.isEmpty()) ownership.add(Criteria.where("_id").in(memberContractIds));
            criteria.add(new Criteria().orOperator(ownership.toArray(Criteria[]::new)));
        } else if (!"ADMIN".equals(principal.role())) {
            List<String> branchIds = "OWNER".equals(principal.role())
                    ? new ArrayList<>(branchAccess.ownedBranchIds(principal.userId()))
                    : branchAccess.managedBranches(principal).stream().map(com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse::id).toList();
            Map<String, Room> roomsById = roomRepository.findByBranchIdInAndIsDeletedFalse(branchIds).stream()
                    .collect(Collectors.toMap(Room::getId, Function.identity()));
            if (roomsById.isEmpty()) criteria.add(Criteria.where("roomId").exists(false));
            else criteria.add(Criteria.where("roomId").in(roomsById.keySet().stream().map(MongoQueryHelper::toObjectId).toList()));
            return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, Contract.class),
                    contract -> response(contract, roomName(roomsById.get(contract.getRoomId()))));
        }
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, Contract.class), this::response);
    }

    @Override
    public ContractResponse update(String id, ContractUpdateRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        requireManager(room(contract.getRoomId()), principal);
        if (contract.getStatus() != ContractStatus.DRAFT)
            throw new ConflictException("Hợp đồng đã ký không được sửa");
        if (request.signedFileUrl() != null) throw new ConflictException("Tải hợp đồng đã ký qua bước bàn giao");
        if (request.status() != null && request.status() != ContractStatus.DRAFT)
            throw new ConflictException("Chỉ luồng bàn giao được đổi trạng thái hợp đồng");
        boolean changesPdf = request.startDate() != null || request.endDate() != null
                || request.rentPrice() != null || request.contractDepositAmount() != null;
        if (changesPdf && contract.getPdfRevision() != null && contract.getTermMonths() != null)
            throw new ConflictException("Hợp đồng đã chốt kỳ hạn và đang chờ ký hoặc duyệt.");
        if (request.startDate() != null) contract.setStartDate(request.startDate());
        if (request.endDate() != null) contract.setEndDate(request.endDate());
        if (request.rentPrice() != null) contract.setRentPrice(request.rentPrice());
        if (request.contractDepositAmount() != null) contract.setContractDepositAmount(request.contractDepositAmount());
        if (request.paymentDueDay() != null) contract.setPaymentDueDay(request.paymentDueDay());
        if (request.terms() != null) contract.setTerms(request.terms());
        if (request.terminatedAt() != null) contract.setTerminatedAt(request.terminatedAt());
        if (request.terminationReason() != null) contract.setTerminationReason(request.terminationReason());
        if (changesPdf && contract.getPdfRevision() != null && contract.getEvidenceSubmittedAt() == null) {
            contractTemplates.queuePdf(contract);
        }
        return response(contractRepository.save(contract));
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        Contract contract = find(id);
        requireManager(room(contract.getRoomId()), principal);
        if (contract.getStatus() != ContractStatus.DRAFT) throw new ConflictException("Chỉ hợp đồng nháp mới được xóa mềm");
        contract.markDeleted();
        contractRepository.save(contract);
    }

    @Override
    public String nextContractNumber() {
        while (true) {
            Document sequence;
            try {
                sequence = mongoTemplate.findAndModify(
                        Query.query(Criteria.where("_id").is("contract-number")),
                        new Update().inc("value", 1),
                        FindAndModifyOptions.options().upsert(true).returnNew(true),
                        Document.class,
                        "contract_sequences");
            } catch (DuplicateKeyException exception) {
                sequence = mongoTemplate.findAndModify(
                        Query.query(Criteria.where("_id").is("contract-number")),
                        new Update().inc("value", 1),
                        FindAndModifyOptions.options().returnNew(true),
                        Document.class,
                        "contract_sequences");
            }
            if (sequence == null) continue;
            Number value = sequence.get("value", Number.class);
            String number = String.format(Locale.ROOT, "HD-%06d", value.longValue());
            if (!contractRepository.existsByContractNumberAndIsDeletedFalse(number)) return number;
        }
    }

    private void refreshRoomStatus(Room room) {
        if (room.getStatus() == RoomStatus.MAINTENANCE || room.getStatus() == RoomStatus.INACTIVE) return;
        List<String> slotIds = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(List.of(room.getId())).stream()
                .map(RoomSlot::getId).toList();
        if (slotIds.isEmpty()) return;
        var active = occupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(slotIds, List.of(OccupancyStatus.ACTIVE));
        boolean allUsed = slotIds.stream().allMatch(slotId -> active.stream().anyMatch(item -> slotId.equals(item.getRoomSlotId())));
        room.setStatus(allUsed ? RoomStatus.OCCUPIED : RoomStatus.AVAILABLE);
        roomRepository.save(room);
    }

    private void requireManager(Room room, AuthPrincipal principal) {
        if (principal == null || !(List.of("OWNER", "MANAGER", "ADMIN").contains(principal.role())))
            throw new ForbiddenException("Chỉ Owner/Manager mới được thao tác hợp đồng");
        if (!"ADMIN".equals(principal.role())) branchAccess.requireManagementAccess(room.getBranchId(), principal);
    }

    private void requireTenant(Contract contract, AuthPrincipal principal) {
        if (principal == null || !"TENANT".equals(principal.role())) throw new ForbiddenException("Chỉ Tenant mới được chọn dịch vụ");
        Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản Tenant"));
        boolean primaryTenant = tenant.getId().equals(contract.getTenantId());
        boolean contractMember = contractTenantRepository.existsByContractIdAndTenantIdAndIsDeletedFalse(
                contract.getId(), tenant.getId());
        if (!primaryTenant && !contractMember) throw new ForbiddenException("Bạn không có quyền thao tác hợp đồng này");
    }

    private Contract find(String id) {
        return contractRepository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
    }
    private Booking booking(String id) {
        return bookingRepository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy booking"));
    }
    private RoomSlot slot(String id) {
        return roomSlotRepository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy slot"));
    }
    private Room room(String id) {
        return roomRepository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
    }

    private ContractResponse response(Contract c) {
        return response(c, null);
    }

    private String roomName(Room room) {
        if (room == null) return null;
        return room.getTitle() == null || room.getTitle().isBlank() ? room.getRoomNumber() : room.getTitle();
    }

    private ContractResponse response(Contract c, String roomName) {
        List<ContractEvidenceHistoryEntry> evidenceHistory = c.getEvidenceHistory() == null
                ? new ArrayList<>() : new ArrayList<>(c.getEvidenceHistory());
        if (evidenceHistory.isEmpty()) {
            if (c.getEvidenceSubmittedAt() != null) {
                evidenceHistory.add(new ContractEvidenceHistoryEntry("SUBMITTED", c.getEvidenceSubmittedAt(), null));
                if (c.getStatus() == ContractStatus.ACTIVE)
                    evidenceHistory.add(new ContractEvidenceHistoryEntry("APPROVED",
                            c.getUpdatedAt() == null ? c.getEvidenceSubmittedAt() : c.getUpdatedAt(), null));
            } else if (c.getEvidenceNote() != null && !c.getEvidenceNote().isBlank()) {
                evidenceHistory.add(new ContractEvidenceHistoryEntry("RESUBMISSION_REQUESTED", c.getUpdatedAt(), c.getEvidenceNote()));
            }
        }
        return new ContractResponse(c.getId(), c.getRoomId(), roomName, c.getRoomSlotId(), c.getRoomSlotIds() == null ? List.of() : List.copyOf(c.getRoomSlotIds()),
                c.getBookingId(), c.getTenantId(), c.getManagerId(),
                c.getContractNumber(), c.getStartDate(), c.getEndDate(), c.getRentPrice(), c.getContractDepositAmount(),
                c.getLandlordName(), c.getLandlordIdNumber(), c.getLandlordAddress(), c.getTenantName(), c.getTenantIdNumber(),
                c.getTenantAddress(), c.getRoomAddress(), c.getMaxOccupants(),
                c.getServices() == null ? List.of() : List.copyOf(c.getServices()), c.getPaymentDueDay(), c.getTerms(), c.getSignedFileUrl(),
                c.getSignedEvidenceUrl(), c.getTermMonths(), c.getSignedDate(), c.getFirstBillingStartDate(), c.getEvidenceSubmittedAt(),
                c.getEvidenceDeadline(), c.getEvidenceResubmissionCount(), c.getEvidenceNote(), evidenceHistory, c.getContractUrl(),
                c.getPdfRevision() != null,
                c.getTerminatedAt(), c.getTerminationReason(), c.getStatus(),
                c.getActiveSlotServices() == null ? List.of() : List.copyOf(c.getActiveSlotServices()),
                com.kitolam.rentalroommanagement.modules.contract.service.support.ContractExpirySupport
                        .isExpiringSoon(c, LocalDate.ofInstant(clock.instant(), VIETNAM_ZONE)),
                c.getRenewedFromContractId(), c.getRenewedToContractId(), c.getCreatedAt(), c.getUpdatedAt());
    }

    @Override
    public List<ReportContract> readForReports(List<String> roomIds) {
        if (roomIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("roomId", roomIds);
        query.addCriteria(Criteria.where("status").ne(ContractStatus.TEMPLATE));
        query.fields().include("roomId", "roomSlotId", "roomSlotIds", "status", "startDate", "endDate", "terminatedAt");
        return mongoTemplate.find(query, Contract.class).stream()
                .map(item -> new ReportContract(item.getId(), item.getRoomId(), item.getStatus(), item.getStartDate(),
                        item.getEndDate(), item.getTerminatedAt(),
                        item.getRoomSlotIds() != null && !item.getRoomSlotIds().isEmpty() ? List.copyOf(item.getRoomSlotIds())
                                : item.getRoomSlotId() == null ? List.of() : List.of(item.getRoomSlotId()))).toList();
    }

    private void addEvidenceHistory(Contract contract, String action, Instant at, String note) {
        if (contract.getEvidenceHistory() == null) contract.setEvidenceHistory(new ArrayList<>());
        if (contract.getEvidenceHistory().isEmpty() && contract.getEvidenceSubmittedAt() != null && !"SUBMITTED".equals(action))
            contract.getEvidenceHistory().add(new ContractEvidenceHistoryEntry("SUBMITTED", contract.getEvidenceSubmittedAt(), null));
        contract.getEvidenceHistory().add(new ContractEvidenceHistoryEntry(action, at, note));
    }
    @Override
    public List<OverviewContract> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("roomId", ids);
        query.addCriteria(Criteria.where("status").ne(ContractStatus.TEMPLATE));
        query.fields().include("roomId", "roomSlotId", "roomSlotIds", "tenantId", "bookingId", "contractNumber", "status", "startDate", "endDate", "evidenceSubmittedAt");
        return mongoTemplate.find(query, Contract.class).stream()
                .map(item -> new OverviewContract(item.getId(), item.getRoomId(), item.getTenantId(), item.getBookingId(), item.getContractNumber(), item.getStatus(), item.getStartDate(), item.getEndDate(), item.getEvidenceSubmittedAt(),
                        item.getRoomSlotIds() != null && !item.getRoomSlotIds().isEmpty() ? List.copyOf(item.getRoomSlotIds())
                                : item.getRoomSlotId() == null ? List.of() : List.of(item.getRoomSlotId()))).toList();
    }

    @Override
    public java.util.List<ActivitySnapshot> readActivitiesForOverview(java.util.List<String> ids, java.time.Instant from, java.time.Instant to) {
        if (ids.isEmpty()) return java.util.List.of();
        var query = MongoQueryHelper.byReferenceIds("_id", ids);
        query.addCriteria(new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                org.springframework.data.mongodb.core.query.Criteria.where("evidenceHistory.at").gte(from).lt(to),
                org.springframework.data.mongodb.core.query.Criteria.where("createdAt").gte(from).lt(to),
                org.springframework.data.mongodb.core.query.Criteria.where("terminatedAt").gte(from).lt(to)));
        query.fields().include("evidenceHistory", "createdAt", "terminatedAt", "terminationReason");
        var result = new java.util.ArrayList<ActivitySnapshot>();
        for (var item : mongoTemplate.find(query, Contract.class)) {
            result.add(new ActivitySnapshot(item.getId() + ":created", item.getId(), "CREATED", item.getCreatedAt(), null, null, null));
            if (item.getTerminatedAt() != null)
                result.add(new ActivitySnapshot(item.getId() + ":terminated", item.getId(), "TERMINATED", item.getTerminatedAt(), null, null, item.getTerminationReason()));
            if (item.getEvidenceHistory() == null) continue;
            for (int i = 0; i < item.getEvidenceHistory().size(); i++) {
                var event = item.getEvidenceHistory().get(i);
                result.add(new ActivitySnapshot(item.getId() + ":" + i, item.getId(), event.action(), event.at(), null, null, event.note()));
            }
        }
        return result.stream().filter(e -> e.within(from, to)).toList();
    }
}
