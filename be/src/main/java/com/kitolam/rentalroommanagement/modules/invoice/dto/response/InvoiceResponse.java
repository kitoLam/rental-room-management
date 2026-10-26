package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record InvoiceResponse(
        String id,
        String contractTenantId,
        String invoiceNumber,
        String period,
        LocalDate issueDate,
        LocalDate dueDate,
        BigDecimal previousDebt,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        InvoiceStatus status,
        List<InvoiceItemResponse> items,
        Instant createdAt,
        Instant updatedAt
) {
}
