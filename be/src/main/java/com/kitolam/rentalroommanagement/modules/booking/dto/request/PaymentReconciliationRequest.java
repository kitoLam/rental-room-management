package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PaymentReconciliationRequest(
        @NotNull Boolean successful,
        @Size(max = 500) String reason
) {
}
