package com.kitolam.rentalroommanagement.modules.contract.document;

import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

public record ContractTerminationSettlement(
        String actorId,
        Instant terminatedAt,
        String reason,
        LocalDate previousAvailableFrom,
        LocalDate availableFrom,
        LocalDate lastRentalDate,
        DepositStatus depositDisposition,
        @Field(targetType = FieldType.DECIMAL128) BigDecimal agreedDepositAmount,
        ElectricityClosing electricity,
        List<InvoiceAdjustment> invoices
) {
    public record ElectricityClosing(
            @Field(targetType = FieldType.DECIMAL128) BigDecimal startReading,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal endReading,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal unitPrice,
            long remainingShares,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal amount
    ) { }

    public record InvoiceAdjustment(
            String invoiceId,
            String period,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal previousTotal,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal total,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal paid,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal outstanding,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal overpaid,
            List<InvoiceItem> items
    ) { }
}
