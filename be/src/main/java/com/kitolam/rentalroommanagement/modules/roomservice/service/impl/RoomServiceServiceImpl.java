package com.kitolam.rentalroommanagement.modules.roomservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.roomservice.mapper.RoomServiceMapper;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceService;
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
public class RoomServiceServiceImpl implements RoomServiceService {

    // Subscriptions change only through the service request workflow so billing always uses confirmed dates.
    private static final String WORKFLOW_ONLY = "Dịch vụ phòng chỉ thay đổi qua yêu cầu đăng ký / ngừng dịch vụ";

    private final RoomServiceRepository roomServiceRepository;
    private final RoomServiceMapper mapper;
    private final MongoTemplate mongoTemplate;

    @Override
    public RoomServiceResponse create(RoomServiceCreateRequest request) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public RoomServiceResponse getById(String id) {
        return mapper.toResponse(find(id));
    }

    @Override
    public PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addObjectIdEquals(criteria, "serviceId", filter.serviceId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, RoomService.class), mapper::toResponse);
    }

    @Override
    public RoomServiceResponse update(String id, RoomServiceUpdateRequest request) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public void delete(String id) {
        throw new UnsupportedOperationException(WORKFLOW_ONLY);
    }

    @Override
    public RoomServiceResponse activate(RoomServiceActivationRequest request) {
        if (findActive(request.roomId(), request.serviceId()).isPresent()) {
            throw new ConflictException("Phòng đang sử dụng dịch vụ này");
        }
        return mapper.toResponse(roomServiceRepository.save(mapper.toDocument(request)));
    }

    @Override
    public RoomServiceResponse terminate(String id, LocalDate endDate, String reason) {
        RoomService roomService = find(id);
        if (roomService.getStatus() != RoomServiceStatus.ACTIVE) {
            throw new ConflictException("Dịch vụ phòng đã ngừng");
        }
        if (endDate.isBefore(roomService.getStartDate())) {
            throw new BadRequestException("Ngày kết thúc không được trước ngày bắt đầu sử dụng");
        }
        roomService.setEndDate(endDate);
        roomService.setStatus(RoomServiceStatus.STOPPED);
        roomService.setStopReason(reason);
        return mapper.toResponse(roomServiceRepository.save(roomService));
    }

    @Override
    public Optional<RoomServiceResponse> findActive(String roomId, String serviceId) {
        Query query = activeQuery(Criteria.where("roomId").is(MongoQueryHelper.toObjectId(roomId)),
                Criteria.where("serviceId").is(MongoQueryHelper.toObjectId(serviceId)));
        return Optional.ofNullable(mongoTemplate.findOne(query, RoomService.class)).map(mapper::toResponse);
    }

    @Override
    public List<RoomServiceResponse> listActiveByRoom(String roomId) {
        Query query = activeQuery(Criteria.where("roomId").is(MongoQueryHelper.toObjectId(roomId)));
        return mongoTemplate.find(query, RoomService.class).stream().map(mapper::toResponse).toList();
    }

    @Override
    public long countActiveByService(String serviceId) {
        return mongoTemplate.count(activeQuery(Criteria.where("serviceId").is(MongoQueryHelper.toObjectId(serviceId))), RoomService.class);
    }

    private RoomService find(String id) {
        return roomServiceRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ phòng"));
    }

    private Query activeQuery(Criteria... conditions) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("status").is(RoomServiceStatus.ACTIVE.name()));
        criteria.addAll(List.of(conditions));
        return new Query(new Criteria().andOperator(criteria));
    }
}
