package com.kitolam.rentalroommanagement.modules.room.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SlotAvailableFromRequest(@NotNull LocalDate availableFrom) {
}
