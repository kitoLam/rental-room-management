package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/** Null means not configured (or inherit the branch rate for a room); zero means free. */
public record UtilityRatesRequest(
        @PositiveOrZero @Digits(integer = 12, fraction = 0) BigDecimal electricityRate,
        @PositiveOrZero @Digits(integer = 12, fraction = 0) BigDecimal waterRate,
        @PositiveOrZero @Digits(integer = 12, fraction = 0) BigDecimal parkingRate
) { }
