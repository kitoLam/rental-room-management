package com.kitolam.rentalroommanagement.modules.shift.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ShiftUpdateRequest(
        @NotNull @PositiveOrZero Long version,
        @NotNull @Size(min = 3, max = 3) List<@NotNull @Valid PeriodInput> periods
) {
    @JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Trường không được phép: " + field);
    }

    public record PeriodInput(
            @NotNull ShiftType type,
            @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String startTime,
            @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String endTime,
            @NotNull Boolean isActive
    ) {
        @JsonAnySetter
        public void rejectUnknown(String field, Object value) {
            throw new IllegalArgumentException("Trường không được phép: " + field);
        }
    }
}
