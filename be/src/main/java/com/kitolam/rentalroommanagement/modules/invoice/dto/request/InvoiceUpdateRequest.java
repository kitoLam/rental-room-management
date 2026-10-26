package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record InvoiceUpdateRequest(
        @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        LocalDate issueDate,
        LocalDate dueDate,
        @PositiveOrZero BigDecimal previousDebt,
        @PositiveOrZero BigDecimal discountAmount,
        InvoiceStatus status,
        @Size(min = 1) List<@Valid InvoiceItemRequest> items
) {
}
