package com.kitolam.rentalroommanagement.modules.invoice.document;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Embedded in Invoice; not a collection on its own. */
@Getter
@Setter
@NoArgsConstructor
public class InvoiceItem {

    @Field(targetType = FieldType.OBJECT_ID)
    private String id;

    private InvoiceItemType type;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    /** Source of a SLOT_SERVICE item. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String slotServiceId;

    /** Source of a ROOM_SERVICE item. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomServiceId;

    /** Meter reading charge of a metered ROOM_SERVICE item. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomServiceChargeId;

    private String description;

    private LocalDate fromDate;

    private LocalDate toDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal quantity;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    /** Negative for DISCOUNT items. */
    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;
}
