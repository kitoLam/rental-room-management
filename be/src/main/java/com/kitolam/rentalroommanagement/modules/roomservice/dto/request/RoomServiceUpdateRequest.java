package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record RoomServiceUpdateRequest(
        @PositiveOrZero BigDecimal unitPrice,
        LocalDate startDate,
        LocalDate endDate,
        RoomServiceStatus status
) {
}
