package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Invoice of one contract for one month; dryRun -> compute and return without saving. */
public record ContractInvoiceCreateRequest(
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        Boolean dryRun
) {
}
