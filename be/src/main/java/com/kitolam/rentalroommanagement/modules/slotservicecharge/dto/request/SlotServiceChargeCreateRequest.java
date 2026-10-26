package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record SlotServiceChargeCreateRequest(
        @NotBlank @ValidObjectId String slotServiceId,
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        @NotEmpty List<@Valid SlotChargeAllocationRequest> allocations
) {
}
