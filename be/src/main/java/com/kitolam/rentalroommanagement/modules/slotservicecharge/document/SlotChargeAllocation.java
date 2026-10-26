package com.kitolam.rentalroommanagement.modules.slotservicecharge.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Embedded in SlotServiceCharge; not a collection on its own. */
@Getter
@Setter
@NoArgsConstructor
public class SlotChargeAllocation {

    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    private LocalDate startAt;

    private LocalDate endAt;

    private Integer days;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;
}
