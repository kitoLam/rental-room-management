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
    private String roomServiceChargeId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String slotServiceChargeId;

    private String description;

    private LocalDate fromDate;

    private LocalDate toDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal quantity;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;
}
