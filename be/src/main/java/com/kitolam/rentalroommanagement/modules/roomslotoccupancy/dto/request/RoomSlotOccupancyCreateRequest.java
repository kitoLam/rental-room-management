package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RoomSlotOccupancyCreateRequest(
        @NotBlank @ValidObjectId String roomSlotId,
        @NotBlank @ValidObjectId String contractTenantId,
        @NotNull LocalDate startDate,
        LocalDate endDate
) {
}
