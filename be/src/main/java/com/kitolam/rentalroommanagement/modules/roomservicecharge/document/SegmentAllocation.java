package com.kitolam.rentalroommanagement.modules.roomservicecharge.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

/** Embedded in RoomServiceCharge; not a collection on its own. */
@Getter
@Setter
@NoArgsConstructor
public class SegmentAllocation {

    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal shareRatio;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;
}
