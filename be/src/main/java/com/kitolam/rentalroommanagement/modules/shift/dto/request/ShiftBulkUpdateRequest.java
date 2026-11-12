package com.kitolam.rentalroommanagement.modules.shift.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

/** One type's HOURS only; each room keeps its own enable state and its other two periods. */
public record ShiftBulkUpdateRequest(
        @NotNull ShiftType type,
        @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String startTime,
        @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String endTime,
        @NotNull @Size(min = 1, max = 100) List<@NotNull @Valid RoomVersion> rooms
) {
    @JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Trường không được phép: " + field);
    }

    public record RoomVersion(@NotBlank @ValidObjectId String roomId, @NotNull @PositiveOrZero Long version) {
        @JsonAnySetter
        public void rejectUnknown(String field, Object value) {
            throw new IllegalArgumentException("Trường không được phép: " + field);
        }
    }
}
