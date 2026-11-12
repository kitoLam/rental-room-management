package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceCalculationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record RoomServiceCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 30) String unit,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        RoomServiceCalculationType calculationType,
        @Size(max = 500) String description
) {
}
