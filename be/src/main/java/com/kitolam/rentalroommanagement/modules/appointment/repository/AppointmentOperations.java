package com.kitolam.rentalroommanagement.modules.appointment.repository;

import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;

public interface AppointmentOperations {
    <T> T withCreationGuards(String accountId, String roomId, String date, Supplier<T> action);
    @FunctionalInterface
    interface ExpiryNotifications { void append(Appointment appointment, String eventId, Update update); }
    int expireDue(Query scope, Instant now, ExpiryNotifications notifications);
    List<Appointment> automationCandidates(String afterId, Instant now, int limit);
    <T> T withAutomationGuard(String id, Supplier<T> action);
    Appointment updateAutomation(String id, Update update);
    Appointment applyAction(String id, AppointmentStatus status, long version, Instant now, Instant selfCancellationDeadline, Update update);
    default Appointment applyAction(String id, AppointmentStatus status, long version, Instant now, Update update) {
        return applyAction(id, status, version, now, null, update);
    }
}
