package com.kitolam.rentalroommanagement.modules.slotservice.dto.response;

import com.kitolam.rentalroommanagement.modules.slotservice.enums.ProrateMethod;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SlotServiceResponse(
        String id,
        String roomSlotId,
        String serviceId,
        Integer quantity,
        BigDecimal unitPrice,
        ProrateMethod prorateMethod,
        LocalDate startDate,
        LocalDate endDate,
        SlotServiceStatus status,
        String stopReason,
        String sourceRequestId,
        Instant createdAt,
        Instant updatedAt
) {
}
