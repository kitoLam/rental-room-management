package com.kitolam.rentalroommanagement.modules.invoice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "invoices")
public class Invoice extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    @Indexed
    private String invoiceNumber;

    private String period;

    private LocalDate issueDate;

    private LocalDate dueDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal previousDebt = BigDecimal.ZERO;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalAmount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal remainingAmount;

    private InvoiceStatus status = InvoiceStatus.DRAFT;

    private List<InvoiceItem> items = new ArrayList<>();
}
