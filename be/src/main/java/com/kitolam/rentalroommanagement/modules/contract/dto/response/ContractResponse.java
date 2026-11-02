package com.kitolam.rentalroommanagement.modules.contract.dto.response;

import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ContractResponse(
        String id,
        String roomId,
        String roomSlotId,
        String bookingId,
        String tenantId,
        String managerId,
        String contractNumber,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal rentPrice,
        BigDecimal contractDepositAmount,
        String landlordName,
        String landlordIdNumber,
        String landlordAddress,
        String tenantName,
        String tenantIdNumber,
        String tenantAddress,
        String roomAddress,
        String roomMode,
        BigDecimal electricityInitialReading,
        BigDecimal waterInitialReading,
        BigDecimal electricityRate,
        BigDecimal waterRate,
        BigDecimal parkingRate,
        Integer maxOccupants,
        List<ContractServiceSnapshot> services,
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
