package com.kitolam.rentalroommanagement.modules.roomservicecharge.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;
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
@Document(collection = "room_service_charges")
@CompoundIndex(name = "room_service_id_period_idx", def = "{'roomServiceId': 1, 'period': 1}")
public class RoomServiceCharge extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomServiceId;

    private String period;

    private RoomServiceChargeStatus status = RoomServiceChargeStatus.DRAFT;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalAmount;

    private List<ChargeSegment> segments = new ArrayList<>();
}
