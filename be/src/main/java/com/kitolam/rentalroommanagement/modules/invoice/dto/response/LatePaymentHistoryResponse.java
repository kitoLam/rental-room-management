package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Một kỳ hoá đơn của hợp đồng từng bị trễ hạn thanh toán. */
public record LatePaymentHistoryResponse(
        String id,
        String invoiceId,
        String period,
        LocalDate dueDate,
        LocalDate firstOverdueDate,
        long lateDays,
        String status,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        int reminderCount,
        Instant lastReminderAt,
        Instant settledAt
) {
}
