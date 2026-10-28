package com.kitolam.rentalroommanagement.modules.appointment.service.impl;

import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment.CancellationCause;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingInventoryGateway;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentAutomationService;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AppointmentAutomationServiceImpl implements AppointmentAutomationService {
    private final AppointmentRepository repository;
    private final ViewingInventoryGateway inventory;
    private final AppointmentNotificationSupport notifications;
    private final NotificationService inbox;
    private final Clock viewingClock;

    @Value("${viewing.automation.enabled:true}")
    private boolean enabled = true;

    @Override
    @Scheduled(fixedDelayString = "${viewing.automation.delay-ms:30000}", initialDelayString = "${viewing.automation.initial-delay-ms:10000}")
    public void runCycle() {
        if (!enabled) return;
        try {
            while (expire(new Query(), viewingClock.instant()) > 0) { /* Drain bounded expiration batches. */ }
            String after = null;
            while (true) {
                var batch = repository.automationCandidates(after, viewingClock.instant(), 100);
                if (batch.isEmpty()) break;
                for (var item : batch) {
                    try {
                        repository.withAutomationGuard(item.getId(), () -> { process(item.getId()); return true; });
                        // Delivery is a separate transaction. Failure cannot undo a saved expiration,
                        // cancellation or reminder marker; the outbox is retained for the next cycle.
                        repository.withAutomationGuard(item.getId(), () -> {
                            repository.findByIdAndIsDeletedFalse(item.getId()).ifPresent(this::dispatch);
                            return true;
                        });
                    }
                    catch (RuntimeException error) { log.warn("Viewing automation will retry appointment {}", item.getId(), error); }
                }
                after = batch.getLast().getId();
            }
        } catch (RuntimeException unavailable) { log.warn("Viewing automation cycle could not finish", unavailable); }
    }

    private int expire(Query scope, Instant now) {
        return repository.expireDue(scope, now, (appointment, eventId, update) -> notifications
                .plan(appointment, eventId, "EXPIRED", now, null, "Hết thời hạn duyệt lịch xem phòng").appendTo(update));
    }

    private void process(String id) {
        var appointment = repository.findByIdAndIsDeletedFalse(id).orElse(null);
        if (appointment == null) return;
        Instant now = viewingClock.instant();
        expire(Query.query(Criteria.where("_id").is(new ObjectId(id))), now);
        appointment = repository.findByIdAndIsDeletedFalse(id).orElseThrow();
        cancelUnavailable(appointment, now);
        appointment = repository.findByIdAndIsDeletedFalse(id).orElseThrow();
        queueReminder(appointment, viewingClock.instant());
    }

    private void cancelUnavailable(Appointment appointment, Instant now) {
        if (!Set.of(AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED).contains(appointment.getStatus())
                || appointment.getStartAt() == null || !appointment.getStartAt().isAfter(now)) return;
        // An unknown/unavailable source must leave the appointment intact for retry.
        // Temporary holds alone never cancel existing appointments.
        com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot room;
        try { room = inventory.getRoom(appointment.getRoomId()); }
        catch (RuntimeException unavailable) {
            log.warn("Could not refresh viewing inventory for room {}", appointment.getRoomId());
            return;
        }
        if (!appointment.getRoomId().equals(room.roomId()) || !java.util.Objects.equals(appointment.getBranchId(), room.branchId())) {
            log.warn("Viewing room {} changed branch; automatic cancellation deferred", appointment.getRoomId());
            return;
        }
        boolean cannotReceive = !room.branchActive() || !room.roomOperational();
        boolean noRentableUnits = room.totalUnits() - room.occupiedUnits() - room.officiallyHeldUnits() <= 0;
        if (!cannotReceive && !noRentableUnits) return;
        var cause = !cannotReceive && room.officiallyHeldUnits() > 0 ? CancellationCause.OFFICIAL_BOOKING : CancellationCause.ROOM_UNAVAILABLE;
        String reason = cause == CancellationCause.OFFICIAL_BOOKING ? "Phòng không còn chỗ thuê do quyền giữ chỗ chính thức có hiệu lực"
                : "Phòng hoặc chi nhánh không còn đủ điều kiện tiếp khách";
        Instant at = viewingClock.instant();
        String eventId = new ObjectId().toHexString();
        var event = new Appointment.HistoryEntry(eventId, "SYSTEM_CANCELLED", null, "Hệ thống", at,
                appointment.getStatus(), AppointmentStatus.CANCELLED, reason, null, null, cause, room.officialBookingIds(), room.sourceRevision());
        var update = new Update().set("status", AppointmentStatus.CANCELLED).set("cancellationCause", cause)
                .set("cancellationReason", reason).push("history", event);
        notifications.plan(appointment, eventId, "SYSTEM_CANCELLED", at, null, reason).appendTo(update);
        repository.applyAction(appointment.getId(), appointment.getStatus(), appointment.getActionVersion(), at,
                appointment.getStartAt().minusMillis(1), update);
    }

    private void queueReminder(Appointment appointment, Instant now) {
        if (appointment.getStatus() == AppointmentStatus.PENDING && appointment.getPendingReminderQueuedAt() == null
                && withinReminderWindow(appointment.getExpiresAt(), appointment.getCreatedAt(), now)) {
            var update = new Update().set("pendingReminderQueuedAt", now);
            notifications.plan(appointment, "reminder-pending:" + appointment.getId(), "REMIND_APPROVAL", now, null, null).appendTo(update);
            repository.updateAutomation(appointment.getId(), update);
        } else if (appointment.getStatus() == AppointmentStatus.CONFIRMED && appointment.getConfirmedReminderQueuedAt() == null
                && withinReminderWindow(appointment.getStartAt(), appointment.getApprovedAt(), now)) {
            var update = new Update().set("confirmedReminderQueuedAt", now);
            notifications.plan(appointment, "reminder-viewing:" + appointment.getId(), "REMIND_VIEWING", now, null, null).appendTo(update);
            repository.updateAutomation(appointment.getId(), update);
        }
    }

    private boolean withinReminderWindow(Instant deadline, Instant origin, Instant now) {
        if (deadline == null || origin == null) return false;
        Instant due = deadline.minus(Duration.ofHours(1));
        return !origin.isAfter(due) && !now.isBefore(due) && now.isBefore(deadline);
    }

    private boolean reminderStillValid(Appointment appointment, String kind, Instant now) {
        if ("REMIND_APPROVAL".equals(kind)) return appointment.getStatus() == AppointmentStatus.PENDING
                && withinReminderWindow(appointment.getExpiresAt(), appointment.getCreatedAt(), now);
        if ("REMIND_VIEWING".equals(kind)) return appointment.getStatus() == AppointmentStatus.CONFIRMED
                && withinReminderWindow(appointment.getStartAt(), appointment.getApprovedAt(), now);
        return true;
    }

    private void dispatch(Appointment appointment) {
        for (var intent : appointment.getNotificationIntents() == null ? List.<Appointment.NotificationIntent>of() : appointment.getNotificationIntents()) {
            if (reminderStillValid(appointment, intent.kind(), viewingClock.instant()) && relatedRecipient(appointment, intent.recipientAccountId())) {
                if (reminderStillValid(appointment, intent.kind(), viewingClock.instant())) publish(appointment, intent);
            }
            repository.updateAutomation(appointment.getId(), new Update().pull("notificationIntents",
                    new Document("eventId", intent.eventId()).append("recipientAccountId", intent.recipientAccountId())));
        }
        for (var retry : appointment.getNotificationRecipientRetries() == null ? List.<Appointment.NotificationRecipientRetry>of() : appointment.getNotificationRecipientRetries()) {
            if (reminderStillValid(appointment, retry.kind(), viewingClock.instant())) {
                for (String recipient : notifications.managementRecipients(appointment.getBranchId(), retry.excludedAccountId())) {
                    if (reminderStillValid(appointment, retry.kind(), viewingClock.instant())) {
                        publish(appointment, new Appointment.NotificationIntent(retry.eventId(), recipient, retry.title(), retry.message(), retry.createdAt(), retry.kind()));
                    }
                }
            }
            repository.updateAutomation(appointment.getId(), new Update().pull("notificationRecipientRetries", new Document("eventId", retry.eventId())));
        }
    }

    private boolean relatedRecipient(Appointment appointment, String accountId) {
        return accountId.equals(appointment.getRequesterAccountId())
                || notifications.managementRecipients(appointment.getBranchId(), null).contains(accountId);
    }

    private void publish(Appointment appointment, Appointment.NotificationIntent intent) {
        String path = intent.recipientAccountId().equals(appointment.getRequesterAccountId()) ? "/user/appointments/" : "/manager/appointments/";
        inbox.publish(new NotificationPublishRequest(intent.eventId(), intent.recipientAccountId(), appointment.getRequesterAccountId(),
                appointment.getId(), appointment.getBranchId(), intent.kind() == null ? "UPDATED" : intent.kind(),
                intent.title(), intent.message(), path + appointment.getId(), intent.createdAt()));
    }
}
