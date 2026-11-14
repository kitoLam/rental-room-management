package com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.response;

import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SlotServiceRequestResponse(
        String id,
        String contractId,
        String contractNumber,
        String tenantId,
        String tenantName,
        String branchId,
        String roomId,
        String roomSlotId,
        String slotServiceId,
        String serviceName,
        BigDecimal unitPrice,
        Integer quantity,
        SlotServiceRequestAction action,
        SlotServiceRequestStatus status,
        String note,
        String rejectReason,
        LocalDate effectiveDate,
        Instant processedAt,
        Instant createdAt
) {
}
