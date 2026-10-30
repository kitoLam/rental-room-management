package com.kitolam.rentalroommanagement.modules.servicerequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** subscriptionId is a room_services or slot_services id of the tenant's current room / slot. */
public record ServiceTerminationRequest(
        @NotBlank @ValidObjectId String subscriptionId,
        @NotNull LocalDate proposedDate,
        @Size(max = 500) String note
) {
}
