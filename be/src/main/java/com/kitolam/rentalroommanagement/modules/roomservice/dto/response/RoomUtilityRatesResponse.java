package com.kitolam.rentalroommanagement.modules.roomservice.dto.response;

public record RoomUtilityRatesResponse(
        String roomId, String branchId, String roomNumber, String branchName,
        UtilityRatesResponse configuredRates, UtilityRatesResponse branchRates, UtilityRatesResponse effectiveRates
) { }
