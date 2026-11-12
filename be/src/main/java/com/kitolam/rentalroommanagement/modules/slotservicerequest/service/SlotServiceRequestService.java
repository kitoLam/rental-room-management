package com.kitolam.rentalroommanagement.modules.slotservicerequest.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestDecisionRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request.SlotServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.response.SlotServiceRequestResponse;
import org.springframework.data.domain.Pageable;

public interface SlotServiceRequestService {

    /** Tenant: ask to add / stop an optional service on one of their ACTIVE contracts. */
    SlotServiceRequestResponse create(SlotServiceRequestCreateRequest request, AuthPrincipal principal);

    /** Tenant: own requests. */
    PagedResponse<SlotServiceRequestResponse> mine(SlotServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Tenant: withdraw a PENDING request. */
    SlotServiceRequestResponse cancel(String id, AuthPrincipal principal);

    /** Staff: requests of the branches they manage. */
    PagedResponse<SlotServiceRequestResponse> search(SlotServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Staff: approve; updates contract.activeSlotServices. */
    SlotServiceRequestResponse approve(String id, SlotServiceRequestDecisionRequest request, AuthPrincipal principal);

    SlotServiceRequestResponse reject(String id, SlotServiceRequestDecisionRequest request, AuthPrincipal principal);

    // ----- read-only projections for dashboards; callers must already have authorized the scope

    /** Requests of the given rooms. */
    java.util.List<OverviewServiceRequest> readForOverview(java.util.List<String> roomIds);

    record OverviewServiceRequest(String roomId, com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus status,
                                  String id, String tenantName, String serviceName, String slotCode) {
    }

    /** Statuses of a contract's requests (tenant overview). */
    java.util.List<com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus> statusesForContract(String contractId);

    /** Created / processed events of the given requests in [from, to). */
    java.util.List<com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot> readActivitiesForOverview(
            java.util.List<String> ids, java.time.Instant from, java.time.Instant to);
}
