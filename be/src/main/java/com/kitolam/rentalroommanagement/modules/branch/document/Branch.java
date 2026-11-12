package com.kitolam.rentalroommanagement.modules.branch.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "branches")
public class Branch extends BaseDocument {
    @Indexed
    @org.springframework.data.mongodb.core.mapping.Field(targetType = org.springframework.data.mongodb.core.mapping.FieldType.OBJECT_ID)
    private String ownerAccountId;

    @Indexed
    private String name;

    private String address;

    private String phone;

    private String email;

    private String description;

    private BranchStatus status = BranchStatus.ACTIVE;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal electricityRate;
    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal waterRate;
    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal parkingRate;
}
