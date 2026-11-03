package com.kitolam.rentalroommanagement.modules.slotservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SlotServiceService {

    SlotServiceResponse create(SlotServiceCreateRequest request);

    SlotServiceResponse getById(String id);

    PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable);

    SlotServiceResponse update(String id, SlotServiceUpdateRequest request);

    void delete(String id);

    /** Internal: starts the subscription (and billing) from the confirmed installation date. */
    SlotServiceResponse activate(SlotServiceActivationRequest request);

    /** Internal: ends an ACTIVE subscription on the confirmed end date. */
    SlotServiceResponse terminate(String id, LocalDate endDate, String reason);

    /** Internal: the ACTIVE subscription of a service on a slot, if any. */
    Optional<SlotServiceResponse> findActive(String roomSlotId, String serviceId);

    /** Internal: all ACTIVE subscriptions of a slot. */
    List<SlotServiceResponse> listActiveBySlot(String roomSlotId);

    long countActiveByService(String serviceId);
}
