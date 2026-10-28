package com.kitolam.rentalroommanagement.modules.room.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.mapper.RoomMapper;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomUtilityRatesResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import java.time.Clock;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final RoomMapper mapper;
    private final BranchService branches;
    private final MongoTemplate mongo;
    private final Clock clock;

    private Room find(String id) {
        return roomRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
    }

    @Override
    public UtilityRatesResponse publicUtilityRates(String roomId) {
        return configuration(find(roomId)).effectiveRates();
    }

    @Override
    public RoomUtilityRatesResponse utilityRateConfiguration(String roomId, AuthPrincipal principal) {
        var room = find(roomId);
        branches.requireManagementAccess(room.getBranchId(), principal);
        return configuration(room);
    }

    @Override
    public RoomUtilityRatesResponse updateUtilityRates(String roomId, UtilityRatesRequest request, AuthPrincipal principal) {
        var room = find(roomId);
        branches.requireManagementAccess(room.getBranchId(), principal);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(MongoQueryHelper.toObjectId(roomId)).and("isDeleted").is(false)),
                new Update().set("electricityRate", request.electricityRate()).set("waterRate", request.waterRate())
                        .set("parkingRate", request.parkingRate()).set("updatedAt", clock.instant()), Room.class);
        return configuration(find(roomId));
    }

    private RoomUtilityRatesResponse configuration(Room room) {
        var branch = branches.getById(room.getBranchId());
        var own = mapper.toUtilityRates(room);
        var defaults = mapper.toUtilityRates(branch);
        var effective = new UtilityRatesResponse(
                own.electricityRate() != null ? own.electricityRate() : defaults.electricityRate(),
                own.waterRate() != null ? own.waterRate() : defaults.waterRate(),
                own.parkingRate() != null ? own.parkingRate() : defaults.parkingRate());
        return new RoomUtilityRatesResponse(room.getId(), branch.id(), room.getRoomNumber(), branch.name(), own, defaults, effective);
    }

    @Override
    public PagedResponse<RoomResponse> listByBranch(String branchId, Pageable pageable) {
        return PagedResponse.from(roomRepository.findWithPagination(Criteria.where("branchId")
                .is(MongoQueryHelper.toObjectId(branchId)), pageable), mapper::toResponse);
    }

    @Override
    public RoomResponse create(RoomCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomResponse getById(String id) {
        return mapper.toResponse(roomRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng")));
    }

    @Override
    public PagedResponse<RoomResponse> search(RoomFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomResponse update(String id, RoomUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
