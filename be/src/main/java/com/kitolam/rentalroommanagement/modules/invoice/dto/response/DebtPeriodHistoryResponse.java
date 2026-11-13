package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Một kỳ hoá đơn có công nợ của hợp đồng, theo thời gian (mới nhất trước). */
public record DebtPeriodHistoryResponse(
        String invoiceId,
        String invoiceNumber,
        String period,
        LocalDate dueDate,
        LocalDate issueDate,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String status,
        /** Số ngày trễ hiện tại của kỳ (0 nếu chưa/chưa từng trễ). */
        long overdueDays,
        /** Số ngày trễ đã ghi nhận vào lịch sử trễ hạn. */
        long lateDays,
        int reminderCount,
        String lateStatus
) {
}
