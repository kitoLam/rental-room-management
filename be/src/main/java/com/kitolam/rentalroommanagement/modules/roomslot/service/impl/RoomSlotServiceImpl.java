package com.kitolam.rentalroommanagement.modules.roomslot.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.response.RoomSlotResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class RoomSlotServiceImpl implements RoomSlotService {

    private final RoomSlotRepository roomSlotRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public RoomSlotResponse create(RoomSlotCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomSlotResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomSlotResponse> search(RoomSlotFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        if (filter.keyword() != null && !filter.keyword().isBlank())
            criteria.add(Criteria.where("slotCode").regex(Pattern.quote(filter.keyword().trim()), "i"));
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, RoomSlot.class), this::response);
    }

    @Override
    public RoomSlotResponse update(String id, RoomSlotUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    private RoomSlotResponse response(RoomSlot slot) {
        return new RoomSlotResponse(slot.getId(), slot.getRoomId(), slot.getSlotCode(), slot.getSlotNumber(),
                slot.getStatus(), slot.getCreatedAt(), slot.getUpdatedAt());
    }
}
