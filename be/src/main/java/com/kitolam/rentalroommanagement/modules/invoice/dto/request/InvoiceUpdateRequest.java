package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Only a DRAFT invoice can be edited: replaces its manual items, generated items stay untouched. */
public record InvoiceUpdateRequest(
        @NotNull List<@Valid InvoiceItemRequest> manualItems
) {
}
