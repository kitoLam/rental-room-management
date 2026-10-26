package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.ProrateMethod;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SlotServiceCreateRequest(
        @NotBlank @ValidObjectId String roomSlotId,
        @NotBlank @ValidObjectId String serviceId,
        @NotNull @Min(1) Integer quantity,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        ProrateMethod prorateMethod,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        String stopReason
) {
}
