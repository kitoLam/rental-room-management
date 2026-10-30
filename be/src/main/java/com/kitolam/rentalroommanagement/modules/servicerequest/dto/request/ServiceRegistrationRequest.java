package com.kitolam.rentalroommanagement.modules.servicerequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Room / slot come from the tenant's active contract, never from the client. */
public record ServiceRegistrationRequest(
        @NotBlank @ValidObjectId String serviceId,
        @NotNull LocalDate proposedDate,
        /* Only used for SLOT services; defaults to 1. */
        @Min(1) @Max(20) Integer quantity,
        @Size(max = 500) String note
) {
}
