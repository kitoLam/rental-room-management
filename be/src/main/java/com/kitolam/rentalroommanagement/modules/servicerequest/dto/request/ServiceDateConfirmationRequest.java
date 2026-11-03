package com.kitolam.rentalroommanagement.modules.servicerequest.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Installation date (REGISTER) or end date (STOP) confirmed by the manager. */
public record ServiceDateConfirmationRequest(
        @NotNull LocalDate effectiveDate,
        @Size(max = 500) String note
) {
}
