package com.kitolam.rentalroommanagement.modules.furniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

/** PATCH semantics: null fields are left unchanged. */
public record FurnitureUpdateRequest(
        @ValidObjectId String roomId,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String name,
        @Min(0) Integer quantity,
        FurnitureCondition condition
) {
}
