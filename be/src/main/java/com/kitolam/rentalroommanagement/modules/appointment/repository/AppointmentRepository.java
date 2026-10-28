package com.kitolam.rentalroommanagement.modules.appointment.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import java.time.LocalDate;
import java.util.List;

public interface AppointmentRepository extends BaseRepository<Appointment>, AppointmentOperations {
    java.util.Optional<Appointment> findByRequesterAccountIdAndIdempotencyKeyAndIsDeletedFalse(String accountId, String key);
    List<Appointment> findByRoomIdAndAppointmentDateAndIsDeletedFalse(String roomId, LocalDate date);
    List<Appointment> findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse(String accountId, LocalDate date);
    List<Appointment> findByTenantIdAndAppointmentDateAndIsDeletedFalse(String tenantId, LocalDate date);
    List<Appointment> findByRoomIdAndAppointmentDateGreaterThanEqualAndIsDeletedFalse(String roomId, LocalDate date);
    List<Appointment> findByRoomIdAndAppointmentDateGreaterThanEqualAndAppointmentDateLessThanAndIsDeletedFalse(String roomId, LocalDate startDate, LocalDate endDate);
}
