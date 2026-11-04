package com.kitolam.rentalroommanagement.modules.contracttenant.dto.response;

import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ContractTenantResponse(
        String id,
        String contractId,
        String tenantId,
        String bookingId,
        List<String> roomSlotIds,
        List<ContractServiceSnapshot> services,
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
