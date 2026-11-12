package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceCalculationType;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** PATCH semantics: null fields are left unchanged. */
public record RoomServiceUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 100) String name,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 30) String unit,
        @PositiveOrZero BigDecimal unitPrice,
        RoomServiceCalculationType calculationType,
        @Size(max = 500) String description,
        RoomServiceStatus status
) {
}
