package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.impl;

import org.springframework.data.mongodb.core.MongoTemplate;

import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.response.RoomSlotOccupancyResponse;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomSlotOccupancyServiceImpl implements RoomSlotOccupancyService {

    private final MongoTemplate overviewMongo;

    private final RoomSlotOccupancyRepository roomSlotOccupancyRepository;

    @Override
    public RoomSlotOccupancyResponse create(RoomSlotOccupancyCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomSlotOccupancyResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomSlotOccupancyResponse> search(RoomSlotOccupancyFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomSlotOccupancyResponse update(String id, RoomSlotOccupancyUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
    @Override
    public List<OverviewOccupancy> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("roomSlotId", ids);
        query.fields().include("roomSlotId", "contractTenantId", "bookingId", "startDate", "endDate", "status");
        return overviewMongo.find(query, RoomSlotOccupancy.class).stream()
                .map(item -> new OverviewOccupancy(item.getRoomSlotId(), item.getContractTenantId(), item.getBookingId(), item.getStartDate(), item.getEndDate(), item.getStatus())).toList();
    }
}
