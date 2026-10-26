package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_slot_occupancies")
public class RoomSlotOccupancy extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractTenantId;

    private LocalDate startDate;

    private LocalDate endDate;

    private OccupancyStatus status = OccupancyStatus.ACTIVE;
}
