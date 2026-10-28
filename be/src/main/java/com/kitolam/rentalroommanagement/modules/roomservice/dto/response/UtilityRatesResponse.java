package com.kitolam.rentalroommanagement.modules.roomservice.dto.response;

import java.math.BigDecimal;

public record UtilityRatesResponse(BigDecimal electricityRate, BigDecimal waterRate, BigDecimal parkingRate) { }
