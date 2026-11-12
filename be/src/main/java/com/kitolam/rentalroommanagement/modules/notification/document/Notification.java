package com.kitolam.rentalroommanagement.modules.notification.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import java.time.Instant;

/** Shared inbox; only the viewing source is connected in this implementation. */
@Document(collection = "notifications")
@CompoundIndex(name = "notification_recipient_date", def = "{'recipientAccountId':1,'isDeleted':1,'createdAt':-1}")
@Getter
@Setter
@NoArgsConstructor
public class Notification extends BaseDocument {
    private String eventId;
    private String recipientAccountId;
    private String requesterAccountId;
    @Field(targetType = FieldType.OBJECT_ID)
    private String appointmentId;
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;
    private String kind;
    private String title;
    private String message;
    private String detailPath;
    private Instant readAt;
}
