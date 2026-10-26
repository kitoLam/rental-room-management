package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record InvoiceCreateRequest(
        @NotBlank @ValidObjectId String contractTenantId,
        @NotBlank String invoiceNumber,
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        @NotNull LocalDate issueDate,
        @NotNull LocalDate dueDate,
        @PositiveOrZero BigDecimal previousDebt,
        @PositiveOrZero BigDecimal discountAmount,
        @NotEmpty List<@Valid InvoiceItemRequest> items
) {
}
