package com.kitolam.rentalroommanagement.modules.serviceitem.dto.request;

import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;

/** Query parameters for search; all optional. */
public record ServiceItemFilterRequest(
        CalculationType calculationType,
        ServiceScope scope,
        ServiceStatus status,
        String keyword
) {
}
