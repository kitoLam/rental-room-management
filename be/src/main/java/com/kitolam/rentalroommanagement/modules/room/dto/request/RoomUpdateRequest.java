package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** PATCH semantics: null fields are left unchanged. Changing maxOccupants adds or removes free slots. */
public record RoomUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 150) String title,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 30) String roomNumber,
        Integer floor,
        @Positive BigDecimal area,
        @Min(1) @Max(30) Integer maxOccupants,
        @PositiveOrZero BigDecimal listedRentPrice,
        @PositiveOrZero BigDecimal listedDepositAmount,
        List<String> amenities,
        List<String> images,
        List<@com.kitolam.rentalroommanagement.common.validation.ValidObjectId String> roomServiceIds,
        String rules,
        RoomStatus status
) {
}
