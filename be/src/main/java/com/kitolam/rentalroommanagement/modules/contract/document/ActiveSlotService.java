package com.kitolam.rentalroommanagement.modules.contract.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * An optional (slot) service the tenant of this contract uses. Created / ended by approved
 * slot service requests; price is a snapshot taken at approval. endDate null = still in use.
 */
@Getter
@Setter
@NoArgsConstructor
public class ActiveSlotService {

    @Field(targetType = FieldType.OBJECT_ID)
    private String slotServiceId;

    private String name;

    private String unit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private Integer quantity;

    private LocalDate startDate;

    private LocalDate endDate;

    @Field(targetType = FieldType.OBJECT_ID)
    private String requestId;

    public boolean isActiveOn(LocalDate day) {
        return !startDate.isAfter(day) && (endDate == null || endDate.isAfter(day));
    }
}
