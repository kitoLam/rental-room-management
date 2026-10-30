package com.kitolam.rentalroommanagement.modules.servicerequest.dto.response;

import java.time.LocalDate;

/** The room / slot the logged-in tenant's service requests apply to. */
public record ServiceTenancyResponse(
        String contractId,
        String contractTenantId,
        boolean representative,
        String branchId,
        String branchName,
        String roomId,
        String roomNumber,
        String roomSlotId,
        String slotCode,
        LocalDate contractStartDate,
        LocalDate contractEndDate
) {
}
