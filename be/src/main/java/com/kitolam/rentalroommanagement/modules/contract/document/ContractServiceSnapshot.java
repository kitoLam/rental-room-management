package com.kitolam.rentalroommanagement.modules.contract.document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class ContractServiceSnapshot {

    @Field(targetType = FieldType.OBJECT_ID)
    private String serviceId;

    private String name;
    private String unit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private String calculationType;
    private boolean mandatory;
    private boolean selected;
}
