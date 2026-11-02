package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ContractCheckInRequest(@NotBlank String signedFileUrl) {}
