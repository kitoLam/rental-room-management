package com.kitolam.rentalroommanagement.modules.contracttenant.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "contract_tenants")
@CompoundIndex(name = "contract_id_tenant_id_idx", def = "{'contractId': 1, 'tenantId': 1}")
public class ContractTenant extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String bookingId;

    private Boolean isRepresentative = false;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal rentAmount;

    private LocalDate joinedAt;

    private LocalDate leftAt;

    private ContractTenantStatus status = ContractTenantStatus.ACTIVE;
}
