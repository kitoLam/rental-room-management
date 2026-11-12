package com.kitolam.rentalroommanagement.modules.roomslot.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.annotation.Version;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_slots")
@CompoundIndex(name = "room_id_slot_code_idx", def = "{'roomId': 1, 'slotCode': 1}")
public class RoomSlot extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    private String slotCode;

    private Integer slotNumber;

    private RoomSlotStatus status = RoomSlotStatus.AVAILABLE;

    /** Ngày bắt đầu cho thuê; chỉ áp dụng cho slot AVAILABLE và tự dời +7 ngày khi đã qua. */
    private LocalDate availableFrom;

    @Version
    private Long version;
}
