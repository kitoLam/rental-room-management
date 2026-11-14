package com.kitolam.rentalroommanagement.modules.slotservicerequest.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contract.document.ActiveSlotService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceCatalogService;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.document.SlotServiceRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestDecisionRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.response.SlotServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.repository.SlotServiceRequestRepository;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.service.SlotServiceRequestService;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SlotServiceRequestServiceImpl implements SlotServiceRequestService {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SlotServiceRequestRepository repository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final RoomRepository roomRepository;
    private final SlotServiceCatalogService slotServices;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    @Override
    public SlotServiceRequestResponse create(SlotServiceRequestCreateRequest request, AuthPrincipal principal) {
        Tenant tenant = currentTenant(principal);
        Contract contract = contractRepository.findByIdAndIsDeletedFalse(request.contractId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
        requireOwner(contract, tenant);
        if (contract.getStatus() != ContractStatus.ACTIVE) {
            throw new BadRequestException("Chỉ hợp đồng đang hiệu lực mới đăng ký / huỷ dịch vụ được");
        }
        Room room = roomRepository.findByIdAndIsDeletedFalse(contract.getRoomId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng của hợp đồng"));
        SlotService service = slotServices.getEntity(request.slotServiceId());
        if (!Objects.equals(service.getBranchId(), room.getBranchId())) {
            throw new BadRequestException("Dịch vụ không thuộc chi nhánh của phòng");
        }
        if (repository.existsByContractIdAndSlotServiceIdAndStatusAndIsDeletedFalse(
                contract.getId(), service.getId(), SlotServiceRequestStatus.PENDING)) {
            throw new ConflictException("Đã có yêu cầu đang chờ duyệt cho dịch vụ này");
        }
        boolean using = active(contract, service.getId()).isPresent();
        if (request.action() == SlotServiceRequestAction.ADD) {
            if (service.getStatus() != SlotServiceStatus.ACTIVE) throw new BadRequestException("Dịch vụ đã ngừng cung cấp");
            if (using) throw new ConflictException("Bạn đang sử dụng dịch vụ này");
        } else if (!using) {
            throw new BadRequestException("Bạn chưa sử dụng dịch vụ này nên không thể huỷ");
        }

        SlotServiceRequest item = new SlotServiceRequest();
        item.setContractId(contract.getId());
        item.setContractNumber(contract.getContractNumber());
        item.setTenantId(tenant.getId());
        item.setTenantName(tenant.getFullName());
        item.setRequesterAccountId(principal.userId());
        item.setBranchId(room.getBranchId());
        item.setRoomId(room.getId());
        item.setRoomSlotId(contract.getRoomSlotId());
        item.setSlotServiceId(service.getId());
        item.setServiceName(service.getName());
        item.setUnit(service.getUnit());
        item.setUnitPrice(service.getUnitPrice());
        item.setQuantity(request.action() == SlotServiceRequestAction.ADD
                ? (request.quantity() == null ? 1 : request.quantity())
                : active(contract, service.getId()).map(ActiveSlotService::getQuantity).orElse(1));
        item.setAction(request.action());
        item.setNote(StringUtils.hasText(request.note()) ? request.note().trim() : null);
        return toResponse(repository.save(item));
    }

    @Override
    public PagedResponse<SlotServiceRequestResponse> mine(SlotServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        Tenant tenant = currentTenant(principal);
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("tenantId").is(new ObjectId(tenant.getId())));
        MongoQueryHelper.addObjectIdEquals(criteria, "contractId", filter.contractId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, SlotServiceRequest.class), this::toResponse);
    }

    @Override
    public SlotServiceRequestResponse cancel(String id, AuthPrincipal principal) {
        Tenant tenant = currentTenant(principal);
        SlotServiceRequest item = getEntity(id);
        if (!Objects.equals(item.getTenantId(), tenant.getId())) throw new NotFoundException("Không tìm thấy yêu cầu");
        requirePending(item);
        item.setStatus(SlotServiceRequestStatus.CANCELLED);
        item.setProcessedAt(clock.instant());
        return toResponse(repository.save(item));
    }

    @Override
    public PagedResponse<SlotServiceRequestResponse> search(SlotServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        if (branchIds != null) criteria.add(Criteria.where("branchId").in(branchIds.stream().map(ObjectId::new).toList()));
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        MongoQueryHelper.addObjectIdEquals(criteria, "contractId", filter.contractId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, SlotServiceRequest.class), this::toResponse);
    }

    @Override
    @Transactional
    public SlotServiceRequestResponse approve(String id, SlotServiceRequestDecisionRequest request, AuthPrincipal principal) {
        SlotServiceRequest item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        requirePending(item);
        LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
        LocalDate effective = request == null || request.effectiveDate() == null ? today : request.effectiveDate();
        if (effective.isBefore(today)) throw new BadRequestException("Ngày hiệu lực không được ở quá khứ");

        Contract contract = contractRepository.findByIdAndIsDeletedFalse(item.getContractId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
        if (contract.getStatus() != ContractStatus.ACTIVE)
            throw new ConflictException("Hợp đồng không còn hiệu lực.");
        if (contract.getActiveSlotServices() == null) contract.setActiveSlotServices(new ArrayList<>());
        if (item.getAction() == SlotServiceRequestAction.ADD) {
            if (active(contract, item.getSlotServiceId()).isPresent()) throw new ConflictException("Hợp đồng đã có dịch vụ này");
            ActiveSlotService added = new ActiveSlotService();
            added.setSlotServiceId(item.getSlotServiceId());
            added.setName(item.getServiceName());
            added.setUnit(item.getUnit());
            added.setUnitPrice(item.getUnitPrice());
            added.setQuantity(item.getQuantity());
            added.setStartDate(effective);
            added.setRequestId(item.getId());
            contract.getActiveSlotServices().add(added);
        } else {
            ActiveSlotService current = active(contract, item.getSlotServiceId())
                    .orElseThrow(() -> new ConflictException("Hợp đồng không còn dùng dịch vụ này"));
            current.setEndDate(effective.isBefore(current.getStartDate()) ? current.getStartDate() : effective);
        }
        contractRepository.save(contract);

        item.setStatus(SlotServiceRequestStatus.APPROVED);
        item.setEffectiveDate(effective);
        item.setProcessedByAccountId(principal.userId());
        item.setProcessedAt(clock.instant());
        return toResponse(repository.save(item));
    }

    @Override
    public SlotServiceRequestResponse reject(String id, SlotServiceRequestDecisionRequest request, AuthPrincipal principal) {
        SlotServiceRequest item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        requirePending(item);
        if (request == null || !StringUtils.hasText(request.reason())) throw new BadRequestException("Cần nhập lý do từ chối");
        item.setStatus(SlotServiceRequestStatus.REJECTED);
        item.setRejectReason(request.reason().trim());
        item.setProcessedByAccountId(principal.userId());
        item.setProcessedAt(clock.instant());
        return toResponse(repository.save(item));
    }

    @Override
    public List<OverviewServiceRequest> readForOverview(List<String> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) return List.of();
        return mongoTemplate.find(new org.springframework.data.mongodb.core.query.Query(new Criteria().andOperator(
                        MongoQueryHelper.notDeleted(),
                        Criteria.where("roomId").in(roomIds.stream().filter(ObjectId::isValid).map(ObjectId::new).toList()))),
                SlotServiceRequest.class).stream()
                .map(r -> new OverviewServiceRequest(r.getRoomId(), r.getStatus(), r.getId(), r.getTenantName(), r.getServiceName(), null))
                .toList();
    }

    @Override
    public List<SlotServiceRequestStatus> statusesForContract(String contractId) {
        if (contractId == null || !ObjectId.isValid(contractId)) return List.of();
        return mongoTemplate.find(new org.springframework.data.mongodb.core.query.Query(new Criteria().andOperator(
                        MongoQueryHelper.notDeleted(), Criteria.where("contractId").is(new ObjectId(contractId)))),
                SlotServiceRequest.class).stream().map(SlotServiceRequest::getStatus).toList();
    }

    @Override
    public List<com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot> readActivitiesForOverview(
            List<String> ids, java.time.Instant from, java.time.Instant to) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot> events = new ArrayList<>();
        for (SlotServiceRequest r : repository.findAllById(ids)) {
            String what = (r.getAction() == SlotServiceRequestAction.ADD ? "Đăng ký " : "Huỷ ") + r.getServiceName();
            events.add(new com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot(r.getId() + ":created", r.getId(),
                    "CREATED", r.getCreatedAt(), r.getRequesterAccountId(), r.getTenantName(), what));
            if (r.getProcessedAt() != null) {
                events.add(new com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot(r.getId() + ":" + r.getStatus(), r.getId(),
                        r.getStatus().name(), r.getProcessedAt(), r.getProcessedByAccountId(), null, r.getRejectReason()));
            }
        }
        return events.stream().filter(e -> e.within(from, to)).toList();
    }

    /** Entry still in use (no end date, or ending in the future). */
    private Optional<ActiveSlotService> active(Contract contract, String slotServiceId) {
        LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
        return contract.getActiveSlotServices() == null ? Optional.empty() : contract.getActiveSlotServices().stream()
                .filter(s -> s.getSlotServiceId().equals(slotServiceId))
                .filter(s -> s.getEndDate() == null || s.getEndDate().isAfter(today))
                .findFirst();
    }

    private void requireOwner(Contract contract, Tenant tenant) {
        boolean representative = Objects.equals(contract.getTenantId(), tenant.getId());
        boolean member = contractTenantRepository.findByTenantIdAndIsDeletedFalse(tenant.getId()).stream()
                .map(ContractTenant::getContractId).anyMatch(contract.getId()::equals);
        if (!representative && !member) throw new ForbiddenException("Hợp đồng không thuộc về bạn");
    }

    private Tenant currentTenant(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        if (!"TENANT".equals(principal.role())) throw new ForbiddenException("Chỉ người thuê mới thao tác được");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
    }

    private void requirePending(SlotServiceRequest item) {
        if (item.getStatus() != SlotServiceRequestStatus.PENDING) throw new ConflictException("Yêu cầu đã được xử lý");
    }

    private SlotServiceRequest getEntity(String id) {
        return repository.findByIdAndIsDeletedFalse(id).orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu"));
    }

    private SlotServiceRequestResponse toResponse(SlotServiceRequest r) {
        return new SlotServiceRequestResponse(r.getId(), r.getContractId(), r.getContractNumber(), r.getTenantId(), r.getTenantName(),
                r.getBranchId(), r.getRoomId(), r.getRoomSlotId(), r.getSlotServiceId(), r.getServiceName(), r.getUnit(),
                r.getUnitPrice(), r.getQuantity(), r.getAction(), r.getStatus(), r.getNote(), r.getRejectReason(),
                r.getEffectiveDate(), r.getProcessedAt(), r.getCreatedAt());
    }
}
