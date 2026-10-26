package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvoiceItemResponse(
        String id,
        InvoiceItemType type,
        String roomServiceChargeId,
        String slotServiceChargeId,
        String description,
        LocalDate fromDate,
        LocalDate toDate,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal amount
) {
}
