package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record BookingCreateRequest(
        @NotEmpty List<@NotBlank @ValidObjectId String> roomSlotIds,
        List<@Valid SelectedServiceRequest> selectedServices,
        Map<String, LocalDate> slotMoveInDates
) {
    public record SelectedServiceRequest(
            @NotBlank @ValidObjectId String serviceId,
            @PositiveOrZero Integer quantity
    ) {}
}
