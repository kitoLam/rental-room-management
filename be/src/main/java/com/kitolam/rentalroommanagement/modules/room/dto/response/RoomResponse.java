package com.kitolam.rentalroommanagement.modules.room.dto.response;

import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RoomResponse(
        String id,
        String branchId,
        String title,
        String roomNumber,
        Integer floor,
        BigDecimal area,
        Integer maxOccupants,
        BigDecimal listedRentPrice,
        BigDecimal listedDepositAmount,
        List<String> amenities,
        List<String> images,
        String rules,
        RoomStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
