package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record InvoiceResponse(
        String id,
        String contractId,
        String tenantId,
        String branchId,
        String roomId,
        String roomNumber,
        String roomSlotId,
        String slotCode,
        String tenantName,
        String contractNumber,
        String invoiceNumber,
        String period,
        LocalDate issueDate,
        LocalDate dueDate,
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
