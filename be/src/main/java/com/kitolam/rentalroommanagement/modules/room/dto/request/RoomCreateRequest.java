package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** maxOccupants slots (S1..Sn) are created together with the room. */
public record RoomCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @Size(max = 150) String title,
        @NotBlank @Size(max = 30) String roomNumber,
        Integer floor,
        @Positive BigDecimal area,
        @NotNull @Min(1) @Max(30) Integer maxOccupants,
        @NotNull @PositiveOrZero BigDecimal listedRentPrice,
        @PositiveOrZero BigDecimal listedDepositAmount,
        List<String> amenities,
        List<String> images,
        /** Ids from the branch's room service catalog (GET /api/v1/room-services?branchId=). */
        List<@ValidObjectId String> roomServiceIds,
        String rules
) {
}
