package com.kitolam.rentalroommanagement.modules.slotservicecharge.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.enums.SlotServiceChargeStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "slot_service_charges")
@CompoundIndex(name = "slot_service_id_period_idx", def = "{'slotServiceId': 1, 'period': 1}")
public class SlotServiceCharge extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String slotServiceId;

    private String period;

    private SlotServiceChargeStatus status = SlotServiceChargeStatus.DRAFT;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalAmount;

    private List<SlotChargeAllocation> allocations = new ArrayList<>();
}
