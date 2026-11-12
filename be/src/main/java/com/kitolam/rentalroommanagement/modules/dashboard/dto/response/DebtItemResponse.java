package com.kitolam.rentalroommanagement.modules.dashboard.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One outstanding invoice. overdueDays is 0 while the invoice is not past its due date. */
public record DebtItemResponse(String invoiceId, String contractTenantId, String tenantName, String tenantPhone,
        String roomId, String roomNumber, String branchId, String branchName, String invoiceNumber, String period,
        LocalDate dueDate, BigDecimal totalAmount, BigDecimal remainingAmount, String status, long overdueDays) {
}
