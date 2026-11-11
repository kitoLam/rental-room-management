package com.kitolam.rentalroommanagement.modules.invoice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceKind;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
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
import java.util.ArrayList;
import java.util.List;

/**
 * Monthly invoice of one contract. Each invoice stands alone: unpaid amounts are never carried
 * into the next period's invoice, so previousDebt stays 0.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "invoices")
// One live MONTHLY invoice per contract and period; supplementary and soft-deleted invoices are not limited.
@CompoundIndex(name = "contract_id_period_kind_uq", def = "{'contractId': 1, 'period': 1, 'kind': 1}",
        unique = true, partialFilter = "{'isDeleted': false, 'kind': 'MONTHLY'}")
public class Invoice extends BaseDocument {

    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    /** Representative tenant of the contract; used for "my invoices". */
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    /** Branch of the contract's room; used to scope manager access. */
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Indexed
    private String invoiceNumber;

    private String period;

    private InvoiceKind kind = InvoiceKind.MONTHLY;

    private LocalDate issueDate;

    private LocalDate dueDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal previousDebt = BigDecimal.ZERO;

    /** Sum of DISCOUNT items, shown as a positive number. */
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
