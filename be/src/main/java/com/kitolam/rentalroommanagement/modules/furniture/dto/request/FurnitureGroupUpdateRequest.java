package com.kitolam.rentalroommanagement.modules.furniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Updates every furniture of a branch called {@code name}. Null fields are left unchanged;
 * roomIds, when sent, becomes the full list of rooms (new rooms get a document, dropped rooms lose it).
 */
public record FurnitureGroupUpdateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank String name,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") @Size(max = 80) String newName,
        @Min(1) Integer quantity,
        FurnitureCondition condition,
        List<@ValidObjectId String> roomIds
) {
}
