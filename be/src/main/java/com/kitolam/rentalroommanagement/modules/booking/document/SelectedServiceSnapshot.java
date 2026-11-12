package com.kitolam.rentalroommanagement.modules.booking.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class SelectedServiceSnapshot {
    @Field(targetType = FieldType.OBJECT_ID)
    private String serviceId;
    private String name;
    private String unit;
    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;
    /** Kept as text for older bookings; new bookings store "FIXED". */
    private String calculationType;
    private String quantityRule;
    private boolean mandatory;
    private Integer quantity;
}
