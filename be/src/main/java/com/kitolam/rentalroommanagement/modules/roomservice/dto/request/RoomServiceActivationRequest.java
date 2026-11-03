package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Internal command from the service request workflow; startDate is the confirmed installation date. */
public record RoomServiceActivationRequest(
        String roomId,
        String serviceId,
        BigDecimal unitPrice,
        LocalDate startDate,
        String sourceRequestId
) {
}
