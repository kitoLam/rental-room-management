package com.kitolam.rentalroommanagement.modules.shift.dto.response;

import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ShiftResponse(String roomId, String branchId, String roomNumber, String branchName,
                            Long version, List<Shift.Period> periods,
                            List<ExistingAppointment> existingAppointments) {
    public record ExistingAppointment(String id, LocalDate date, ShiftType type,
                                      Instant startAt, Instant endAt, String status) { }
}
