package com.kitolam.rentalroommanagement.modules.serviceitem.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "services")
public class ServiceItem extends BaseDocument {

    @Indexed
    private String code;

    private String name;

    private String unit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private CalculationType calculationType;

    private ServiceScope scope;

    private ServiceStatus status = ServiceStatus.ACTIVE;
}
