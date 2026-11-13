package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TenantDebtResponse(
        String id,
        String contractId,
        String contractNumber,
        String contractStatus,
        LocalDate contractStartDate,
        LocalDate contractEndDate,
        LocalDate contractSignedDate,
        BigDecimal contractDepositAmount,
        Integer paymentDueDay,
        LocalDate joinedAt,
        String contractTenantId,
        String tenantId,
        String tenantName,
        String tenantEmail,
        String tenantPhone,
        String tenantIdNumber,
        String tenantGender,
        LocalDate tenantDateOfBirth,
        String tenantAddress,
        String branchId,
        String branchName,
        String roomId,
        String roomNumber,
        String period,
        LocalDate dueDate,
        long overdueDays,
        boolean overdue,
        BigDecimal roomRentAmount,
        List<TenantDebtServiceItemResponse> registeredServices,
        BigDecimal registeredServicesAmount,
        BigDecimal electricityAmount,
        BigDecimal waterAmount,
        BigDecimal unpaidUtilityAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String status,
        /** Số ngày trễ đã ghi nhận cho kỳ này trước lần nhắc gần nhất (0 nếu chưa từng trễ). */
        long recordedLateDays,
        /** Số lần hệ thống đã gửi nhắc nhở cho kỳ này. */
        int reminderCount,
        /** Lịch sử trễ hạn của các kỳ trước của hợp đồng. */
        List<LatePaymentHistoryResponse> latePaymentHistory
) {
}
