package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvoiceItemRequest(
        @NotNull InvoiceItemType type,
        @ValidObjectId String roomServiceChargeId,
        @ValidObjectId String slotServiceChargeId,
        String description,
        LocalDate fromDate,
        LocalDate toDate,
        @NotNull @Positive BigDecimal quantity,
        @NotNull @PositiveOrZero BigDecimal unitPrice
) {
}
