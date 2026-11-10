package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/**
 * Manually added item (OTHER, PENALTY, DEPOSIT, DISCOUNT). Generated types are rejected.
 * For DISCOUNT give a positive unitPrice; the stored amount becomes negative.
 */
public record InvoiceItemRequest(
        @NotNull InvoiceItemType type,
        @NotBlank String description,
        @NotNull @Positive BigDecimal quantity,
        @NotNull @PositiveOrZero BigDecimal unitPrice
) {
}
