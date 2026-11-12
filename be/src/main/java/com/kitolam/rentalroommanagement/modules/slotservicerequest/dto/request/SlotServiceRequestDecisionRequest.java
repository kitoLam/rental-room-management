package com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Approve: effectiveDate optional (default today). Reject: reason required. */
public record SlotServiceRequestDecisionRequest(
        LocalDate effectiveDate,
        @Size(max = 500) String reason
) {
}
