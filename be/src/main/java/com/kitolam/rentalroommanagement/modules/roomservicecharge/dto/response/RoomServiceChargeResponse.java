package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response;

import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RoomServiceChargeResponse(
        String id,
        String roomServiceId,
        String period,
        RoomServiceChargeStatus status,
        BigDecimal totalAmount,
        List<ChargeSegmentResponse> segments,
        Instant createdAt,
        Instant updatedAt
) {
}
