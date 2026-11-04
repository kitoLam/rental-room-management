package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ContractEvidenceReviewRequest(
        @NotNull Boolean approved,
        @Size(max = 500) String note,
        LocalDate adjustedSignedDate,
        LocalDate firstBillingStartDate
) {
}
