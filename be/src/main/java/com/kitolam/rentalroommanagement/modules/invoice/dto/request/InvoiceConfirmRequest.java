package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/** contractIds empty / null = every slot of the branch still without an invoice for the period. */
public record InvoiceConfirmRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        List<@ValidObjectId String> contractIds
) {
}
