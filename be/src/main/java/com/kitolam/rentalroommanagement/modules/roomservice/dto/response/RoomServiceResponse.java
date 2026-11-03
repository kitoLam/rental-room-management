package com.kitolam.rentalroommanagement.modules.roomservice.dto.response;

import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record RoomServiceResponse(
        String id,
        String roomId,
        String serviceId,
        BigDecimal unitPrice,
        LocalDate startDate,
        LocalDate endDate,
        RoomServiceStatus status,
        String stopReason,
        String sourceRequestId,
        Instant createdAt,
        Instant updatedAt
) {
}
