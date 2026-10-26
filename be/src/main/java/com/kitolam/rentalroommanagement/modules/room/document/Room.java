package com.kitolam.rentalroommanagement.modules.room.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
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
@Document(collection = "rooms")
@CompoundIndex(name = "branch_id_room_number_idx", def = "{'branchId': 1, 'roomNumber': 1}")
public class Room extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomTypeId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String managerId;

    private String roomNumber;

    private Integer floor;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal area;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal listedRentPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal listedDepositAmount;

    private Integer maxOccupants;

    private List<String> amenities = new ArrayList<>();

    private List<String> images = new ArrayList<>();

    private String rules;

    private RoomStatus status = RoomStatus.AVAILABLE;
}
