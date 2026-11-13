package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotNull;

public record ContractTermRequest(@NotNull Integer termMonths) { }
