package com.kitolam.rentalroommanagement.modules.shift.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.DayOfWeek;
import java.util.Set;

public record ShiftCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank String name,
        @NotEmpty Set<DayOfWeek> daysOfWeek,
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String startTime,
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String endTime,
        @NotNull @Min(1) Integer maxAppointments,
        Boolean isActive
) {
}
