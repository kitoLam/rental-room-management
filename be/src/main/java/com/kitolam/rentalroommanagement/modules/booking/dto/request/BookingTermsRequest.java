package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import jakarta.validation.constraints.NotNull;

public record BookingTermsRequest(@NotNull Boolean accepted) {
}
