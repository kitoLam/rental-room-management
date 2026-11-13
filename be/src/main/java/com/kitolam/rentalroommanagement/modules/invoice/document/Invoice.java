package com.kitolam.rentalroommanagement.modules.invoice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
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
 * Monthly invoice of one contract (= one slot) for one period. Each invoice stands alone: unpaid
 * amounts are never carried into the next one.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "invoices")
@CompoundIndex(name = "contract_id_period_uq", def = "{'contractId': 1, 'period': 1}", unique = true,
        partialFilter = "{'isDeleted': false, 'contractId': {$exists: true}}")
public class Invoice extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    /** Representative tenant of the contract; used for "my invoices". */
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    /** Snapshots for listing without joins. */
    private String roomNumber;
    private String slotCode;
    private String tenantName;
    private String contractNumber;

    @Indexed
    private String invoiceNumber;

    /** yyyy-MM */
    private String period;

    private LocalDate issueDate;

    private LocalDate dueDate;

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
