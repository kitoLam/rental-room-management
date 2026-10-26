package com.kitolam.rentalroommanagement.modules.shift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.util.Set;

/** PATCH semantics: null fields are left unchanged. */
public record ShiftUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String name,
        @Size(min = 1) Set<DayOfWeek> daysOfWeek,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String startTime,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "định dạng HH:mm") String endTime,
        @Min(1) Integer maxAppointments,
        Boolean isActive
) {
}
