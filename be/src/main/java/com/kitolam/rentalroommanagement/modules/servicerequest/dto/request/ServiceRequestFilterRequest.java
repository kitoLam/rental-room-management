package com.kitolam.rentalroommanagement.modules.servicerequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;

/** Query parameters for search; all optional. keyword matches service, tenant and room. */
public record ServiceRequestFilterRequest(
        ServiceRequestStatus status,
        ServiceRequestAction action,
        @ValidObjectId String branchId,
        @ValidObjectId String roomId,
        String keyword
) {
}
