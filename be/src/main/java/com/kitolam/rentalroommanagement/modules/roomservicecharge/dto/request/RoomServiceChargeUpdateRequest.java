package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

/** PATCH semantics: null fields are left unchanged. */
public record RoomServiceChargeUpdateRequest(
        RoomServiceChargeStatus status,
        @Size(min = 1) List<@Valid ChargeSegmentRequest> segments
) {
}
