package com.kitolam.rentalroommanagement.modules.appointment.dto.response;

import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ViewingAvailabilityResponse(
        String roomId, LocalDate date, String timeZone, Instant checkedAt, Long configurationVersion,
        ViewingEligibilityResponse room, List<Period> periods
) {
    public record Period(String id, ShiftType type, String startTime, String endTime,
                         Instant startAt, Instant endAt, boolean isActive, boolean available, Reason reason) { }
    public enum Reason {
        AVAILABLE, ROOM_UNAVAILABLE, DISABLED, STARTED, ROOM_TAKEN,
        TENANT_ROOM_DAY, TENANT_SAME_TYPE, TENANT_TIME_OVERLAP
    }
}
