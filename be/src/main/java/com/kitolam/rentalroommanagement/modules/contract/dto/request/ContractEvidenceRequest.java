package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ContractEvidenceRequest(
        @NotBlank String evidenceUrl,
        @NotNull Integer termMonths,
        LocalDate signedDate
) {
}
