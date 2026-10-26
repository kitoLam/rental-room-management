package com.kitolam.rentalroommanagement.modules.slotservicecharge.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.response.SlotServiceChargeResponse;
import org.springframework.data.domain.Pageable;

public interface SlotServiceChargeService {

    SlotServiceChargeResponse create(SlotServiceChargeCreateRequest request);

    SlotServiceChargeResponse getById(String id);

    PagedResponse<SlotServiceChargeResponse> search(SlotServiceChargeFilterRequest filter, Pageable pageable);

    SlotServiceChargeResponse update(String id, SlotServiceChargeUpdateRequest request);

    void delete(String id);
}
