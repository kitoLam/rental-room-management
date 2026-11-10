package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * contractId → one contract; roomId → every contract holding a slot in that room;
 * neither → every contract in effect during the period (within the caller's branches).
 * dryRun → compute and return without saving.
 */
public record InvoiceGenerateRequest(
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        @ValidObjectId String contractId,
        @ValidObjectId String roomId,
        Boolean dryRun
) {
}
