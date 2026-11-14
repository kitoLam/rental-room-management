package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** PATCH semantics: null fields are left unchanged. */
public record SlotServiceUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 100) String name,
        @PositiveOrZero BigDecimal unitPrice,
        @Size(max = 500) String description,
        SlotServiceStatus status
) {
}
