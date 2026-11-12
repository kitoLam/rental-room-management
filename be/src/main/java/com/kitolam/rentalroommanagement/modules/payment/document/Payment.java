package com.kitolam.rentalroommanagement.modules.payment.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "payments")
public class Payment extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String invoiceId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String bookingId;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private PaymentMethod method;

    @Indexed
    private String transactionCode;
    private String gatewayTransactionNo;

    private Instant paidAt;

    private PaymentStatus status = PaymentStatus.PENDING;
}
