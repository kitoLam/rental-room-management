package com.kitolam.rentalroommanagement.modules.contract.service.impl;

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
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractDraftRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomMode;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
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

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ContractServiceImpl implements ContractService {

    private final ContractRepository contractRepository;
    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository occupancyRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final BranchRepository branchRepository;
    private final BranchService branchAccess;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public ContractResponse createDraftFromBooking(String bookingId, ContractDraftRequest request, AuthPrincipal principal) {
        Booking booking = booking(bookingId);
        RoomSlot slot = slot(booking.getRoomSlotId());
        Room room = room(slot.getRoomId());
        requireManager(room, principal);
        if (booking.getStatus() != BookingStatus.CONFIRMED || booking.getDepositStatus() != DepositStatus.PAID)
            throw new ConflictException("Chỉ booking đã xác nhận và đã nộp cọc mới lập được hợp đồng");
        Instant checkInDeadline = booking.getCheckInDeadline() == null ? request.checkInDeadline() : booking.getCheckInDeadline();
        if (!checkInDeadline.isAfter(clock.instant()))
            throw new ConflictException("Đã quá hạn check-in của booking");
        if (booking.getCheckInDeadline() != null
                && Math.abs(Duration.between(booking.getCheckInDeadline(), request.checkInDeadline()).toMillis()) >= 60_000)
            throw new ConflictException("Hạn check-in phải khớp điều khoản đã gửi cho Tenant");
        if (occupancyRepository.findByBookingIdAndIsDeletedFalse(bookingId).stream()
                .noneMatch(item -> item.getRoomSlotId().equals(slot.getId()) && item.getStatus() == OccupancyStatus.RESERVED))
            throw new ConflictException("Booking không còn reservation đang hoạt động");
        int maxAllowed = room.getRoomMode() == RoomMode.PER_SLOT || room.getMaxOccupants() == null ? 1 : room.getMaxOccupants();
        if (request.maxOccupants() > maxAllowed)
            throw new BadRequestException("Số người tối đa trong hợp đồng vượt sức chứa của phòng/chỗ");
        var existing = contractRepository.findByBookingIdAndIsDeletedFalse(bookingId).orElse(null);
        if (existing != null) {
            if (existing.getStatus() == ContractStatus.DRAFT) return response(existing);
            throw new ConflictException("Booking đã có hợp đồng");
        }

        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(booking.getTenantId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người thuê"));
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(room.getBranchId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chi nhánh"));
        Contract contract = new Contract();
        contract.setBookingId(booking.getId());
        contract.setRoomId(room.getId());
        contract.setRoomSlotId(slot.getId());
        contract.setTenantId(tenant.getId());
        contract.setManagerId(principal.userId());
        contract.setContractNumber(nextContractNumber());
        contract.setStartDate(booking.getExpectedMoveInDate());
        contract.setEndDate(booking.getExpectedMoveOutDate());
        contract.setRentPrice(request.rentPrice());
        contract.setContractDepositAmount(request.contractDepositAmount());
        contract.setPaymentDueDay(request.paymentDueDay());
        contract.setTerms(request.terms().trim());
        contract.setLandlordName(request.landlordName().trim());
        contract.setLandlordIdNumber(request.landlordIdNumber().trim());
        contract.setLandlordAddress(request.landlordAddress().trim());
        contract.setTenantName(tenant.getFullName());
        contract.setTenantIdNumber(tenant.getIdCardNumber());
        contract.setTenantAddress(tenant.getAddress());
        contract.setRoomAddress(branch.getAddress() + " · " + room.getRoomNumber());
        contract.setRoomMode(room.getRoomMode().name());
        contract.setElectricityInitialReading(request.electricityInitialReading());
        contract.setWaterInitialReading(request.waterInitialReading());
        contract.setElectricityRate(request.electricityRate());
        contract.setWaterRate(request.waterRate());
        contract.setParkingRate(request.parkingRate());
        contract.setMaxOccupants(request.maxOccupants());
        contract.setServices(serviceSnapshots(request.services()));
        contract.setStatus(ContractStatus.DRAFT);
        contract.setId(new ObjectId().toHexString());
        contractRepository.save(contract);
        Booking claimed = mongoTemplate.findAndModify(
                Query.query(Criteria.where("_id").is(new ObjectId(bookingId)).and("contractId").is(null)),
                new Update().set("contractId", new ObjectId(contract.getId())).set("checkInDeadline", checkInDeadline),
                FindAndModifyOptions.options().returnNew(true), Booking.class);
        if (claimed == null) {
            contract.markDeleted();
            contractRepository.save(contract);
            return contractRepository.findByBookingIdAndIsDeletedFalse(bookingId)
                    .filter(current -> current.getStatus() == ContractStatus.DRAFT)
                    .map(this::response)
                    .orElseThrow(() -> new ConflictException("Booking vừa được cập nhật; vui lòng tải lại"));
        }
        return response(contract);
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
        return response(contractRepository.save(contract));
    }

    @Override
    @Transactional
    public ContractResponse completeCheckIn(String id, ContractCheckInRequest request, AuthPrincipal principal) {
        Contract contract = find(id);
        Booking booking = booking(contract.getBookingId());
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
        if (booking.getCheckInDeadline() == null || !booking.getCheckInDeadline().isAfter(clock.instant()))
            throw new ConflictException("Đã quá hạn check-in của booking");
        if (contract.getServices() != null && contract.getServices().stream().anyMatch(s -> s.isMandatory() && !s.isSelected()))
            throw new ConflictException("Hợp đồng chưa có đủ dịch vụ bắt buộc");
        ContractTenant contractTenant = contractTenantRepository.findByBookingIdAndIsDeletedFalse(booking.getId())
                .orElseGet(() -> {
                    ContractTenant created = new ContractTenant();
                    created.setContractId(contract.getId());
                    created.setTenantId(booking.getTenantId());
                    created.setBookingId(booking.getId());
                    created.setIsRepresentative(true);
                    created.setRentAmount(contract.getRentPrice());
                    created.setJoinedAt(booking.getExpectedMoveInDate());
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
        Contract saved = contractRepository.save(contract);
        booking.setStatus(BookingStatus.CONVERTED);
        if (booking.getTimeline() == null) booking.setTimeline(new ArrayList<>());
        booking.getTimeline().add(new BookingTimelineEntry(BookingStatus.CONVERTED.name(), clock.instant(), "Đã bàn giao phòng và lưu hợp đồng đã ký giấy."));
        bookingRepository.save(booking);
        refreshRoomStatus(room);
        eventPublisher.publishEvent(new BookingStatusChangedEvent(booking.getId(), booking.getTenantId(),
                booking.getStatus(), booking.getDepositStatus(), "Bàn giao phòng hoàn tất."));
        return response(saved);
    }

    @Override
    public ContractResponse create(ContractCreateRequest request) {
        throw new ConflictException("Hợp đồng phải được tạo từ booking đã xác nhận và nộp cọc");
    }

    @Override
    public ContractResponse getById(String id, AuthPrincipal principal) {
        Contract contract = find(id);
        if (principal != null && "TENANT".equals(principal.role())) requireTenant(contract, principal);
        else requireManager(room(contract.getRoomId()), principal);
        return response(contract);
    }

    @Override
    public PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        if (principal == null || !List.of("TENANT", "OWNER", "MANAGER", "ADMIN").contains(principal.role()))
            throw new ForbiddenException("Không có quyền tìm kiếm hợp đồng");
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addObjectIdEquals(criteria, "managerId", filter.managerId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "contractNumber", "tenantName", "landlordName");
        if ("TENANT".equals(principal.role())) {
            Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản Tenant"));
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
            List<String> roomIds = roomRepository.findByBranchIdInAndIsDeletedFalse(branchIds).stream().map(Room::getId).toList();
            if (roomIds.isEmpty()) criteria.add(Criteria.where("roomId").exists(false));
            else criteria.add(Criteria.where("roomId").in(roomIds.stream().map(MongoQueryHelper::toObjectId).toList()));
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
        if (request.startDate() != null) contract.setStartDate(request.startDate());
        if (request.endDate() != null) contract.setEndDate(request.endDate());
        if (request.rentPrice() != null) contract.setRentPrice(request.rentPrice());
        if (request.contractDepositAmount() != null) contract.setContractDepositAmount(request.contractDepositAmount());
        if (request.paymentDueDay() != null) contract.setPaymentDueDay(request.paymentDueDay());
        if (request.terms() != null) contract.setTerms(request.terms());
        if (request.terminatedAt() != null) contract.setTerminatedAt(request.terminatedAt());
        if (request.terminationReason() != null) contract.setTerminationReason(request.terminationReason());
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

    private List<ContractServiceSnapshot> serviceSnapshots(List<ContractDraftRequest.ContractServiceRequest> input) {
        List<ContractServiceSnapshot> result = new ArrayList<>();
        if (input == null) return result;
        for (var item : input) {
            if (result.stream().anyMatch(s -> s.getServiceId().equals(item.serviceId())))
                throw new BadRequestException("Dịch vụ trong hợp đồng không được trùng");
            ContractServiceSnapshot snapshot = new ContractServiceSnapshot();
            snapshot.setServiceId(item.serviceId());
            snapshot.setName(item.name().trim());
            snapshot.setUnit(item.unit().trim());
            snapshot.setUnitPrice(item.unitPrice());
            snapshot.setCalculationType(item.calculationType().trim());
            snapshot.setMandatory(item.mandatory());
            snapshot.setSelected(item.mandatory());
            result.add(snapshot);
        }
        return result;
    }

    private String nextContractNumber() {
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
        if (room.getRoomMode() == RoomMode.WHOLE_ROOM) {
            room.setStatus(RoomStatus.OCCUPIED);
        } else {
            var active = occupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(slotIds, List.of(OccupancyStatus.ACTIVE));
            boolean allUsed = slotIds.stream().allMatch(slotId -> active.stream().anyMatch(item -> slotId.equals(item.getRoomSlotId())));
            room.setStatus(allUsed ? RoomStatus.OCCUPIED : RoomStatus.AVAILABLE);
        }
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
        return new ContractResponse(c.getId(), c.getRoomId(), c.getRoomSlotId(), c.getBookingId(), c.getTenantId(), c.getManagerId(),
                c.getContractNumber(), c.getStartDate(), c.getEndDate(), c.getRentPrice(), c.getContractDepositAmount(),
                c.getLandlordName(), c.getLandlordIdNumber(), c.getLandlordAddress(), c.getTenantName(), c.getTenantIdNumber(),
                c.getTenantAddress(), c.getRoomAddress(), c.getRoomMode(), c.getElectricityInitialReading(), c.getWaterInitialReading(),
                c.getElectricityRate(), c.getWaterRate(), c.getParkingRate(), c.getMaxOccupants(),
                c.getServices() == null ? List.of() : List.copyOf(c.getServices()), c.getPaymentDueDay(), c.getTerms(), c.getSignedFileUrl(),
                c.getTerminatedAt(), c.getTerminationReason(), c.getStatus(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
