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
        String status
) {
}

