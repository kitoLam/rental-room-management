package com.kitolam.rentalroommanagement.modules.furniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record FurnitureCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank String name,
        @NotNull @Min(0) Integer quantity,
        FurnitureCondition condition
) {
}
