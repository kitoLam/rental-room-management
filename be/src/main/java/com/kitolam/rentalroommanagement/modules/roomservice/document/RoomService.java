package com.kitolam.rentalroommanagement.modules.roomservice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_services")
public class RoomService extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String serviceId;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private LocalDate startDate;

    private LocalDate endDate;

    private RoomServiceStatus status = RoomServiceStatus.ACTIVE;

    private String stopReason;

    /** Service request whose confirmed installation created this subscription. */
    @Field(targetType = FieldType.OBJECT_ID)
    private String sourceRequestId;
}
