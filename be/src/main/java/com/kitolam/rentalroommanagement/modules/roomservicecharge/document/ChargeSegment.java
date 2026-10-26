package com.kitolam.rentalroommanagement.modules.roomservicecharge.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Embedded in RoomServiceCharge; not a collection on its own. */
@Getter
@Setter
@NoArgsConstructor
public class ChargeSegment {

    @Field(targetType = FieldType.OBJECT_ID)
    private String id;

    private LocalDate startAt;

    private LocalDate endAt;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal previousReading;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal currentReading;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal usage;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private List<SegmentAllocation> allocations = new ArrayList<>();
}
