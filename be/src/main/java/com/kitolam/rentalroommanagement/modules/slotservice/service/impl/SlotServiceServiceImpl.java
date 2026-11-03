package com.kitolam.rentalroommanagement.modules.slotservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import com.kitolam.rentalroommanagement.modules.slotservice.mapper.SlotServiceMapper;
import com.kitolam.rentalroommanagement.modules.slotservice.repository.SlotServiceRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SlotServiceServiceImpl implements SlotServiceService {

    // Subscriptions change only through the service request workflow so billing always uses confirmed dates.
    private static final String WORKFLOW_ONLY = "Dịch vụ theo chỗ chỉ thay đổi qua yêu cầu đăng ký / ngừng dịch vụ";

    private final SlotServiceRepository slotServiceRepository;
    private final SlotServiceMapper mapper;
    private final MongoTemplate mongoTemplate;

    @Override
    public SlotServiceResponse create(SlotServiceCreateRequest request) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public SlotServiceResponse getById(String id) {
        return mapper.toResponse(find(id));
    }

    @Override
    public PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addObjectIdEquals(criteria, "roomSlotId", filter.roomSlotId());
        MongoQueryHelper.addObjectIdEquals(criteria, "serviceId", filter.serviceId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, SlotService.class), mapper::toResponse);
    }

    @Override
    public SlotServiceResponse update(String id, SlotServiceUpdateRequest request) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public void delete(String id) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public SlotServiceResponse activate(SlotServiceActivationRequest request) {
        if (findActive(request.roomSlotId(), request.serviceId()).isPresent()) {
            throw new ConflictException("Chỗ ở đang sử dụng dịch vụ này");
        }
        return mapper.toResponse(slotServiceRepository.save(mapper.toDocument(request)));
    }

    @Override
    public SlotServiceResponse terminate(String id, LocalDate endDate, String reason) {
        SlotService slotService = find(id);
        if (slotService.getStatus() != SlotServiceStatus.ACTIVE) {
            throw new ConflictException("Dịch vụ theo chỗ đã ngừng");
        }
        if (endDate.isBefore(slotService.getStartDate())) {
            throw new BadRequestException("Ngày kết thúc không được trước ngày bắt đầu sử dụng");
        }
        slotService.setEndDate(endDate);
        slotService.setStatus(SlotServiceStatus.STOPPED);
        slotService.setStopReason(reason);
        return mapper.toResponse(slotServiceRepository.save(slotService));
    }

    @Override
    public Optional<SlotServiceResponse> findActive(String roomSlotId, String serviceId) {
        Query query = activeQuery(Criteria.where("roomSlotId").is(MongoQueryHelper.toObjectId(roomSlotId)),
                Criteria.where("serviceId").is(MongoQueryHelper.toObjectId(serviceId)));
        return Optional.ofNullable(mongoTemplate.findOne(query, SlotService.class)).map(mapper::toResponse);
    }

    @Override
    public List<SlotServiceResponse> listActiveBySlot(String roomSlotId) {
        Query query = activeQuery(Criteria.where("roomSlotId").is(MongoQueryHelper.toObjectId(roomSlotId)));
        return mongoTemplate.find(query, SlotService.class).stream().map(mapper::toResponse).toList();
    }

    @Override
    public long countActiveByService(String serviceId) {
        return mongoTemplate.count(activeQuery(Criteria.where("serviceId").is(MongoQueryHelper.toObjectId(serviceId))), SlotService.class);
    }

    private SlotService find(String id) {
        return slotServiceRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ theo chỗ"));
    }

    private Query activeQuery(Criteria... conditions) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("status").is(SlotServiceStatus.ACTIVE.name()));
        criteria.addAll(List.of(conditions));
        return new Query(new Criteria().andOperator(criteria));
    }
}
