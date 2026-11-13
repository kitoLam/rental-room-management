package com.kitolam.rentalroommanagement.modules.roomservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceCatalogService;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RoomServiceCatalogServiceImpl implements RoomServiceCatalogService {

    private final RoomServiceRepository repository;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;

    @Override
    public RoomServiceResponse create(RoomServiceCreateRequest request, AuthPrincipal principal) {
        staffAccess.requireBranch(request.branchId(), principal);
        RoomService item = new RoomService();
        item.setBranchId(request.branchId());
        item.setName(request.name().trim());
        item.setUnit(request.unit().trim());
        item.setUnitPrice(request.unitPrice());
        if (request.calculationType() != null) item.setCalculationType(request.calculationType());
        item.setDescription(request.description());
        ensureUniqueName(item);
        return toResponse(repository.save(item));
    }

    @Override
    public RoomServiceResponse getById(String id, AuthPrincipal principal) {
        RoomService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        return toResponse(item);
    }

    @Override
    public PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        if (branchIds != null) criteria.add(Criteria.where("branchId").in(branchIds.stream().map(ObjectId::new).toList()));
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "name");
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, RoomService.class), this::toResponse);
    }

    @Override
    public RoomServiceResponse update(String id, RoomServiceUpdateRequest request, AuthPrincipal principal) {
        RoomService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        if (request.name() != null) item.setName(request.name().trim());
        if (request.unit() != null) item.setUnit(request.unit().trim());
        if (request.unitPrice() != null) item.setUnitPrice(request.unitPrice());
        if (request.calculationType() != null) item.setCalculationType(request.calculationType());
        if (request.description() != null) item.setDescription(request.description());
        if (request.status() != null) item.setStatus(request.status());
        ensureUniqueName(item);
        return toResponse(repository.save(item));
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        RoomService item = getEntity(id);
        staffAccess.requireBranch(item.getBranchId(), principal);
        // Still attached to a room: removing it would silently drop the fee from those rooms' invoices.
        List<String> rooms = mongoTemplate.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("roomServiceIds").is(MongoQueryHelper.toObjectId(item.getId())))), Room.class).stream()
                .map(Room::getRoomNumber).filter(Objects::nonNull).sorted().toList();
        if (!rooms.isEmpty()) {
            throw new ConflictException("Không thể xoá dịch vụ phòng “" + item.getName() + "” vì còn " + rooms.size()
                    + " phòng đang dùng: " + String.join(", ", rooms)
                    + ". Hãy bỏ dịch vụ này khỏi các phòng đó trước (hoặc chuyển sang ngừng hoạt động).");
        }
        item.markDeleted();
        repository.save(item);
    }

    @Override
    public List<RoomServiceResponse> activeOfBranch(String branchId) {
        return repository.findByBranchIdAndStatusAndIsDeletedFalseOrderByNameAsc(branchId, RoomServiceStatus.ACTIVE)
                .stream().map(this::toResponse).toList();
    }

    @Override
    public RoomService getEntity(String id) {
        return repository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ phòng với id: " + id));
    }

    @Override
    public RoomServiceResponse toResponse(RoomService item) {
        return new RoomServiceResponse(item.getId(), item.getBranchId(), item.getName(), item.getUnit(), item.getUnitPrice(),
                item.getCalculationType(), item.getDescription(), item.getStatus(), item.getCreatedAt(), item.getUpdatedAt());
    }

    private void ensureUniqueName(RoomService item) {
        if (MongoQueryHelper.existsOther(mongoTemplate, RoomService.class, item.getId(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(item.getBranchId())),
                Criteria.where("name").is(item.getName()))) {
            throw new ConflictException("Chi nhánh đã có dịch vụ phòng tên \"" + item.getName() + "\"");
        }
    }
}
