package com.kitolam.rentalroommanagement.modules.contract.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "contracts")
public class Contract extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String managerId;

    @Indexed
    private String contractNumber;

    private LocalDate startDate;

    private LocalDate endDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal rentPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal contractDepositAmount;

    private Integer paymentDueDay;

    private String terms;

    private String signedFileUrl;

    private Instant terminatedAt;

    private String terminationReason;

    private ContractStatus status = ContractStatus.DRAFT;
}
