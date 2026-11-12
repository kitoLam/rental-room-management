package com.kitolam.rentalroommanagement.modules.shift.service;

import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;

/** Storage and configuration invariants; AppointmentService checks caller permissions. */
public interface ShiftService {
    Shift getForRoom(String roomId);
    Shift updateForRoom(String roomId, ShiftUpdateRequest request);
    void lockForAppointment(String roomId, Long version);
}
