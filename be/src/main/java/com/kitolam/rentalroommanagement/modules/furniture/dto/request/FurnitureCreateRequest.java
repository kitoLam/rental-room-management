package com.kitolam.rentalroommanagement.modules.furniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Creates one furniture document per room in roomIds (quantity defaults to 1, condition to GOOD). */
public record FurnitureCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @Size(max = 80) String name,
        @Min(1) Integer quantity,
        FurnitureCondition condition,
        @NotEmpty List<@ValidObjectId String> roomIds
) {
}
