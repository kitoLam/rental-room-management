package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomMode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record RoomCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @ValidObjectId String roomTypeId,
        @ValidObjectId String managerId,
        @NotBlank String roomNumber,
        Integer floor,
        @Positive BigDecimal area,
        @NotNull @PositiveOrZero BigDecimal listedRentPrice,
        @PositiveOrZero BigDecimal listedDepositAmount,
        @NotNull RoomMode roomMode,
        @NotNull @Min(1) Integer maxOccupants,
        List<String> amenities,
        List<String> images,
        String rules
) {
}
