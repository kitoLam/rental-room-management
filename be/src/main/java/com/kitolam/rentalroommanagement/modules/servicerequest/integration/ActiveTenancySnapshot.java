package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Read model of the tenant's current rental, supplied by the contract / occupancy modules.
 * roomSlotId is null when the tenant rents the whole room.
 */
public record ActiveTenancySnapshot(
        String tenantId,
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
    public ActiveTenancySnapshot {
        Objects.requireNonNull(branchId, "branchId");
        Objects.requireNonNull(roomId, "roomId");
    }
}
