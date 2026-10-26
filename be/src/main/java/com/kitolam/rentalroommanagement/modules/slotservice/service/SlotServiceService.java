package com.kitolam.rentalroommanagement.modules.slotservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import org.springframework.data.domain.Pageable;

public interface SlotServiceService {

    SlotServiceResponse create(SlotServiceCreateRequest request);

    SlotServiceResponse getById(String id);

    PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable);

    SlotServiceResponse update(String id, SlotServiceUpdateRequest request);

    void delete(String id);
}
