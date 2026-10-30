package com.kitolam.rentalroommanagement.modules.servicerequest.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Aggregate root of one tenant request to register or stop an optional service.
 * The subscription itself lives in room_services / slot_services and is only created or
 * stopped when a manager confirms the date, so billing never starts from the request date.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "service_requests")
@CompoundIndex(name = "service_request_branch_status_idx", def = "{'branchId': 1, 'status': 1, 'createdAt': -1}")
public class ServiceRequest extends BaseDocument {

    private ServiceRequestAction action;

    private ServiceRequestStatus status = ServiceRequestStatus.PENDING;

    /** Optimistic lock: two managers processing the same request get 409 instead of a double transition. */
    @Version
    private Long version;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    /** Auth account that sent the request; used for "my requests" and notifications. */
    @Indexed
    private String requesterAccountId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String serviceId;

    private ServiceScope scope;

    /** STOP: the subscription to end. REGISTER: the subscription created when installation is confirmed. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String subscriptionId;

    private Integer quantity;

    /** Price agreed when the request was sent; later catalog price changes do not affect it. */
    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    /** Date suggested by the tenant; only a proposal. */
    private LocalDate proposedDate;

    /** Installation or end date confirmed by the manager; billing uses this one. */
    private LocalDate confirmedDate;

    private LocalDate contractEndDate;

    private String note;

    private String rejectReason;

    private String processedByAccountId;

    private Instant processedAt;

    // Display snapshots, so lists do not call other modules once per row.
    private String serviceName;

    private String tenantName;

    private String roomNumber;

    private String slotCode;

    /** Present only while the request is open: one open request per service and room/slot. */
    @Indexed(unique = true, sparse = true)
    private String openKey;

    private List<HistoryEntry> history = new ArrayList<>();

    public static String openKey(ServiceScope scope, String targetId, String serviceId) {
        return scope + ":" + targetId + ":" + serviceId;
    }

    public void submit(String targetId, String actorAccountId, Instant at) {
        status = ServiceRequestStatus.PENDING;
        openKey = openKey(scope, targetId, serviceId);
        history.add(new HistoryEntry(null, ServiceRequestStatus.PENDING, actorAccountId, note, at));
    }

    public void approve(String actorAccountId, String comment, Instant at) {
        if (action != ServiceRequestAction.REGISTER || status != ServiceRequestStatus.PENDING) {
            throw new ConflictException("Chỉ duyệt được yêu cầu đăng ký đang chờ duyệt");
        }
        transition(ServiceRequestStatus.APPROVED, actorAccountId, comment, at);
    }

    public void reject(String actorAccountId, String reason, Instant at) {
        boolean rejectable = status == ServiceRequestStatus.PENDING
                || (action == ServiceRequestAction.REGISTER && status == ServiceRequestStatus.APPROVED);
        if (!rejectable) {
            throw new ConflictException("Yêu cầu đã được xử lý, không thể từ chối");
        }
        rejectReason = reason;
        close(ServiceRequestStatus.REJECTED, actorAccountId, reason, at);
    }

    public void cancel(String actorAccountId, String comment, Instant at) {
        if (status != ServiceRequestStatus.PENDING) {
            throw new ConflictException("Chỉ hủy được yêu cầu đang chờ duyệt");
        }
        close(ServiceRequestStatus.CANCELLED, actorAccountId, comment, at);
    }

    /** Checked before the subscription is created / stopped, so no write happens on a stale request. */
    public void ensureCompletable() {
        if (action == ServiceRequestAction.REGISTER && status != ServiceRequestStatus.APPROVED) {
            throw new ConflictException("Yêu cầu đăng ký cần được duyệt trước khi xác nhận lắp đặt");
        }
        if (action == ServiceRequestAction.STOP && status != ServiceRequestStatus.PENDING) {
            throw new ConflictException("Yêu cầu ngừng dịch vụ đã được xử lý");
        }
    }

    public void complete(LocalDate effectiveDate, String confirmedSubscriptionId, String actorAccountId, String comment, Instant at) {
        ensureCompletable();
        confirmedDate = effectiveDate;
        subscriptionId = confirmedSubscriptionId;
        close(ServiceRequestStatus.COMPLETED, actorAccountId, comment, at);
    }

    private void close(ServiceRequestStatus to, String actorAccountId, String comment, Instant at) {
        openKey = null;
        transition(to, actorAccountId, comment, at);
    }

    private void transition(ServiceRequestStatus to, String actorAccountId, String comment, Instant at) {
        history.add(new HistoryEntry(status, to, actorAccountId, comment, at));
        status = to;
        processedByAccountId = actorAccountId;
        processedAt = at;
    }

    public record HistoryEntry(ServiceRequestStatus statusFrom, ServiceRequestStatus statusTo,
                               String actorAccountId, String note, Instant at) {
    }
}
