package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request;

import com.kitolam.rentalroommanagement.modules.slotservicecharge.enums.SlotServiceChargeStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record SlotServiceChargeUpdateRequest(
        SlotServiceChargeStatus status,
        @Size(min = 1) List<@Valid SlotChargeAllocationRequest> allocations
) {
}
