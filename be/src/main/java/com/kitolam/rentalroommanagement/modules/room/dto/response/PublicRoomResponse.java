package com.kitolam.rentalroommanagement.modules.room.dto.response;

import java.math.BigDecimal;
import java.util.List;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;

public record PublicRoomResponse(
        PublicRoom room,
        String branchId,
        String branchName,
        String address,
        String roomTypeName,
        UtilityRatesResponse utilityRates
) {
    public record PublicRoom(
            String id,
            String branchId,
            String roomTypeId,
            String code,
            String rentalMode,
            Integer capacity,
            BigDecimal areaSqm,
            Integer floorNumber,
            BigDecimal referencePrice,
            String description,
            List<String> amenities,
            List<String> imageRefs,
            String operationalStatus
    ) {
    }
}
