package com.kitolam.rentalroommanagement.modules.slotservicerequest.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Tenant asks to add or stop an optional (slot) service on one of their contracts; staff approves. */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "slot_service_requests")
public class SlotServiceRequest extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    private String requesterAccountId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String slotServiceId;

    private String serviceName;

    private String unit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private Integer quantity;

    private SlotServiceRequestAction action;

    private SlotServiceRequestStatus status = SlotServiceRequestStatus.PENDING;

    private String note;

    private String rejectReason;

    /** Day the service starts (ADD) or stops (CANCEL); set on approval. */
    private LocalDate effectiveDate;

    private String processedByAccountId;

    private Instant processedAt;

    private String tenantName;

    private String contractNumber;
}
