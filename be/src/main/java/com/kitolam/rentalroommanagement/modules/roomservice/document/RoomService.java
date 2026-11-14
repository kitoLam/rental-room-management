package com.kitolam.rentalroommanagement.modules.roomservice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

/**
 * Dịch vụ phòng of a branch (catalog entry): one monthly price for the whole room, split between
 * the occupants of the month. Only branch staff can change it.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_services")
@CompoundIndex(name = "branch_id_name_idx", def = "{'branchId': 1, 'name': 1}")
public class RoomService extends BaseDocument {

    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    private String name;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private String description;

    private RoomServiceStatus status = RoomServiceStatus.ACTIVE;
}
