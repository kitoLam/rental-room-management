package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record RoomUpdateRequest(
        @ValidObjectId String roomTypeId,
        @ValidObjectId String managerId,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String roomNumber,
        Integer floor,
        @Positive BigDecimal area,
        @PositiveOrZero BigDecimal listedRentPrice,
        @PositiveOrZero BigDecimal listedDepositAmount,
        @Min(1) Integer maxOccupants,
        List<String> amenities,
        List<String> images,
        String rules,
        RoomStatus status
) {
}
