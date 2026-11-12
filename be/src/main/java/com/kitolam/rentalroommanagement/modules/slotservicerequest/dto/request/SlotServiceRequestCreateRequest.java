package com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestAction;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** quantity is used for ADD only (default 1). */
public record SlotServiceRequestCreateRequest(
        @NotBlank @ValidObjectId String contractId,
        @NotBlank @ValidObjectId String slotServiceId,
        @NotNull SlotServiceRequestAction action,
        @Min(1) @Max(10) Integer quantity,
        @Size(max = 500) String note
) {
}
