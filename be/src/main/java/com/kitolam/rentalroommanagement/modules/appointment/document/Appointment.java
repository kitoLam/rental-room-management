package com.kitolam.rentalroommanagement.modules.appointment.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "appointments")
@CompoundIndex(name = "appointment_request_key", def = "{'requesterAccountId':1,'idempotencyKey':1}",
        unique = true, partialFilter = "{'requesterAccountId':{$type:'string'},'idempotencyKey':{$type:'string'}}")
public class Appointment extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String shiftId;

    private LocalDate appointmentDate;

    @Indexed
    private String requesterAccountId;
    private ShiftType shiftType;
    // Immutable hours of the appointment, independent of later shift configuration edits.
    private Instant startAt;
    private Instant endAt;
    private Instant expiresAt;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;
    private String roomNumber;
    private String branchName;
    private String publicContactPhone;
    private String contactName;
    private String contactPhone;
    private Long configurationVersion;
    private String idempotencyKey;
    private String requestFingerprint;
    private List<HistoryEntry> history = new ArrayList<>();
    // Committed with the appointment; automation delivers these to the shared inbox and removes them.
    private List<NotificationIntent> notificationIntents = new ArrayList<>();
    private List<NotificationRecipientRetry> notificationRecipientRetries = new ArrayList<>();
    private Instant pendingReminderQueuedAt;
    private Instant confirmedReminderQueuedAt;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String proposedShiftId;

    private LocalDate proposedDate;

    private String note;

    private String rejectReason;

    private String result;

    private long actionVersion;
    private String approvedBy;
    private String approvedByName;
    private Instant approvedAt;
    private String cancellationReason;
    private CancellationCause cancellationCause;

    public enum CancellationCause { TENANT_REQUEST, LANDLORD_UNAVAILABLE, OFFICIAL_BOOKING, ROOM_UNAVAILABLE }

    private AppointmentStatus status = AppointmentStatus.PENDING;

    public record HistoryEntry(String id, String action, String actorAccountId, String actorName,
                               Instant at, AppointmentStatus before, AppointmentStatus after, String reason,
                               String previousNote, String note, CancellationCause cancellationCause,
                               List<String> relatedBookingIds, String sourceRevision) {
        public HistoryEntry(String id, String action, String actorAccountId, String actorName,
                            Instant at, AppointmentStatus before, AppointmentStatus after, String reason,
                            String previousNote, String note, CancellationCause cancellationCause) {
            this(id, action, actorAccountId, actorName, at, before, after, reason, previousNote, note, cancellationCause, List.of(), null);
        }
        public HistoryEntry(String id, String action, String actorAccountId, String actorName,
                            Instant at, AppointmentStatus before, AppointmentStatus after, String reason) {
            this(id, action, actorAccountId, actorName, at, before, after, reason, null, null, null);
        }
    }
    public record NotificationIntent(String eventId, String recipientAccountId, String title,
                                      String message, Instant createdAt, String kind) {
        public NotificationIntent(String eventId, String recipientAccountId, String title, String message, Instant createdAt) {
            this(eventId, recipientAccountId, title, message, createdAt, null);
        }
    }
    public record NotificationRecipientRetry(String eventId, String branchId, String excludedAccountId,
                                             String title, String message, Instant createdAt, String kind) {
        public NotificationRecipientRetry(String eventId, String branchId, String excludedAccountId, String title, String message, Instant createdAt) {
            this(eventId, branchId, excludedAccountId, title, message, createdAt, null);
        }
    }
}
