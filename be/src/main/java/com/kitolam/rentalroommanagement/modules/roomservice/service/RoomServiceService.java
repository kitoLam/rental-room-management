package com.kitolam.rentalroommanagement.modules.roomservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RoomServiceService {

    RoomServiceResponse create(RoomServiceCreateRequest request);

    RoomServiceResponse getById(String id);

    PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable);

    RoomServiceResponse update(String id, RoomServiceUpdateRequest request);

    void delete(String id);

    /** Internal: starts the subscription (and billing) from the confirmed installation date. */
    RoomServiceResponse activate(RoomServiceActivationRequest request);

    /** Internal: ends an ACTIVE subscription on the confirmed end date. */
    RoomServiceResponse terminate(String id, LocalDate endDate, String reason);

    /** Internal: the ACTIVE subscription of a service in a room, if any. */
    Optional<RoomServiceResponse> findActive(String roomId, String serviceId);

    /** Internal: all ACTIVE subscriptions of a room. */
    List<RoomServiceResponse> listActiveByRoom(String roomId);

    long countActiveByService(String serviceId);
}
