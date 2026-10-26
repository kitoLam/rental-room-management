package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RoomServiceCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank @ValidObjectId String serviceId,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        @NotNull LocalDate startDate,
        LocalDate endDate
) {
}
