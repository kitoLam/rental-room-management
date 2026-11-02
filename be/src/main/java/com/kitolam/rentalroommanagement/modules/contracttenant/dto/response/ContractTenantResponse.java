package com.kitolam.rentalroommanagement.modules.contracttenant.dto.response;

import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ContractTenantResponse(
        String id,
        String contractId,
        String tenantId,
        String bookingId,
        String tenantName,
        String tenantEmail,
        Boolean isRepresentative,
        BigDecimal rentAmount,
        LocalDate joinedAt,
        LocalDate leftAt,
        ContractTenantStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
