package com.kitolam.rentalroommanagement.modules.slotservice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.ProrateMethod;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "slot_services")
public class SlotService extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String serviceId;

    private Integer quantity;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private ProrateMethod prorateMethod = ProrateMethod.BY_DAY;

    private LocalDate startDate;

    private LocalDate endDate;

    private SlotServiceStatus status = SlotServiceStatus.ACTIVE;

    private String stopReason;

    /** Service request whose confirmed installation created this subscription. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String sourceRequestId;
}
