package com.kitolam.rentalroommanagement.modules.room.dto.response;

import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RoomResponse(
        String id,
        String branchId,
        String roomTypeId,
        String managerId,
        String roomNumber,
        Integer floor,
        BigDecimal area,
        BigDecimal listedRentPrice,
        BigDecimal listedDepositAmount,
        Integer maxOccupants,
        List<String> amenities,
        List<String> images,
        String rules,
        RoomStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
