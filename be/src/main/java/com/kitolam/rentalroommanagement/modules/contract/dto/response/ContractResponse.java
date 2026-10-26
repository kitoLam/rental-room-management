package com.kitolam.rentalroommanagement.modules.contract.dto.response;

import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ContractResponse(
        String id,
        String roomId,
        String managerId,
        String contractNumber,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal rentPrice,
        BigDecimal contractDepositAmount,
        Integer paymentDueDay,
        String terms,
        String signedFileUrl,
        Instant terminatedAt,
        String terminationReason,
        ContractStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
