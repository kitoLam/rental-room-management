package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import com.kitolam.rentalroommanagement.modules.slotservice.enums.ProrateMethod;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record SlotServiceUpdateRequest(
        @Min(1) Integer quantity,
        @PositiveOrZero BigDecimal unitPrice,
        ProrateMethod prorateMethod,
        LocalDate startDate,
        LocalDate endDate,
        SlotServiceStatus status,
        String stopReason
) {
}
