package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ContractEvidenceRequest(
        @NotBlank String evidenceUrl,
        @NotNull Integer termMonths
) {
}
