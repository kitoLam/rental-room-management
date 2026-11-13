package com.kitolam.rentalroommanagement.modules.slotservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import com.kitolam.rentalroommanagement.modules.slotservice.repository.SlotServiceRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceCatalogService;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.document.SlotServiceRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SlotServiceCatalogServiceImpl implements SlotServiceCatalogService {

    private final SlotServiceRepository repository;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;

    @Override
    public SlotServiceResponse create(SlotServiceCreateRequest request, AuthPrincipal principal) {
        staffAccess.requireBranch(request.branchId(), principal);
        SlotService item = new SlotService();
        item.setBranchId(request.branchId());
        item.setName(request.name().trim());
        item.setUnit(request.unit().trim());
        item.setUnitPrice(request.unitPrice());
        item.setDescription(request.description());
        ensureUniqueName(item);
        return toResponse(repository.save(item));
    }

    @Override
    public SlotServiceResponse getById(String id, AuthPrincipal principal) {
        SlotService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        return toResponse(item);
    }

    @Override
    public PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        if (branchIds != null) criteria.add(Criteria.where("branchId").in(branchIds.stream().map(ObjectId::new).toList()));
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "name");
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, SlotService.class), this::toResponse);
    }

    @Override
    public SlotServiceResponse update(String id, SlotServiceUpdateRequest request, AuthPrincipal principal) {
        SlotService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        if (request.name() != null) item.setName(request.name().trim());
        if (request.unit() != null) item.setUnit(request.unit().trim());
        if (request.unitPrice() != null) item.setUnitPrice(request.unitPrice());
        if (request.description() != null) item.setDescription(request.description());
        if (request.status() != null) item.setStatus(request.status());
        ensureUniqueName(item);
        return toResponse(repository.save(item));
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        SlotService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        ObjectId serviceId = MongoQueryHelper.toObjectId(item.getId());
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        // Tenants still using it on a draft / running contract.
        List<String> users = mongoTemplate.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("status").in(ContractStatus.DRAFT.name(), ContractStatus.ACTIVE.name()),
                        Criteria.where("activeSlotServices.slotServiceId").is(serviceId))), Contract.class).stream()
                .filter(c -> c.getActiveSlotServices().stream().anyMatch(s -> item.getId().equals(s.getSlotServiceId())
                        && (s.getEndDate() == null || s.getEndDate().isAfter(today))))
                .map(c -> Objects.toString(c.getTenantName(), "Người thuê") + " (" + Objects.toString(c.getContractNumber(), c.getId()) + ")")
                .toList();
        long pending = mongoTemplate.count(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("slotServiceId").is(serviceId),
                Criteria.where("status").is(SlotServiceRequestStatus.PENDING.name()))), SlotServiceRequest.class);
        if (!users.isEmpty() || pending > 0) {
            StringBuilder message = new StringBuilder("Không thể xoá dịch vụ tự chọn “" + item.getName() + "” vì");
            if (!users.isEmpty()) message.append(" còn ").append(users.size()).append(" người đang đăng ký: ").append(String.join(", ", users));
            if (!users.isEmpty() && pending > 0) message.append(";");
            if (pending > 0) message.append(" còn ").append(pending).append(" yêu cầu đăng ký / huỷ đang chờ duyệt");
            message.append(". Hãy xử lý các đăng ký / yêu cầu này trước (hoặc chuyển dịch vụ sang ngừng hoạt động).");
            throw new ConflictException(message.toString());
        }
        item.markDeleted();
        repository.save(item);
    }

    @Override
    public List<SlotServiceResponse> activeOfBranch(String branchId) {
        return repository.findByBranchIdAndStatusAndIsDeletedFalseOrderByNameAsc(branchId, SlotServiceStatus.ACTIVE)
                .stream().map(this::toResponse).toList();
    }

    @Override
    public SlotService getEntity(String id) {
        return repository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ tự chọn với id: " + id));
    }

    @Override
    public SlotServiceResponse toResponse(SlotService item) {
        return new SlotServiceResponse(item.getId(), item.getBranchId(), item.getName(), item.getUnit(), item.getUnitPrice(),
                item.getDescription(), item.getStatus(), item.getCreatedAt(), item.getUpdatedAt());
    }

    private void ensureUniqueName(SlotService item) {
        if (MongoQueryHelper.existsOther(mongoTemplate, SlotService.class, item.getId(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(item.getBranchId())),
                Criteria.where("name").is(item.getName()))) {
            throw new ConflictException("Chi nhánh đã có dịch vụ tự chọn tên \"" + item.getName() + "\"");
        }
    }
}
