package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Internal command from the service request workflow; startDate is the confirmed installation date. */
public record SlotServiceActivationRequest(
        String roomSlotId,
        String serviceId,
        Integer quantity,
        BigDecimal unitPrice,
        LocalDate startDate,
        String sourceRequestId
) {
}
