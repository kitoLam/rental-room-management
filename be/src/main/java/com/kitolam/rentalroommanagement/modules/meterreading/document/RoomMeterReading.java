package com.kitolam.rentalroommanagement.modules.meterreading.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

/**
 * Electricity meter of one room for one month: start / end reading, usage and amount.
 * unitPrice is the branch electricity rate at the time of saving.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_meter_readings")
@CompoundIndex(name = "room_id_period_uq", def = "{'roomId': 1, 'period': 1}", unique = true,
        partialFilter = "{'isDeleted': false}")
public class RoomMeterReading extends BaseDocument {

    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    /** yyyy-MM */
    private String period;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal startReading;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal endReading;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal usage;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private MeterReadingStatus status = MeterReadingStatus.DRAFT;

    private String note;
}
