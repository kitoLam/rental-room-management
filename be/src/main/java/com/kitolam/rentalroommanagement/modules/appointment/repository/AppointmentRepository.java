package com.kitolam.rentalroommanagement.modules.appointment.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;

import java.time.LocalDate;
import java.util.List;

public interface AppointmentRepository extends BaseRepository<Appointment> {
    List<Appointment> findByRoomIdAndAppointmentDateGreaterThanEqualAndAppointmentDateLessThanAndIsDeletedFalse(
            String roomId, LocalDate startDate, LocalDate endDate);
}
