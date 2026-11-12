package com.kitolam.rentalroommanagement.modules.slotservice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;

/** Dịch vụ tự chọn of a branch (catalog entry). Only branch staff can change it. */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "slot_services")
@CompoundIndex(name = "branch_id_name_idx", def = "{'branchId': 1, 'name': 1}")
public class SlotService extends BaseDocument {

    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    private String name;

    /** e.g. "phòng/tháng", "xe/tháng". */
    private String unit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    private String description;

    private SlotServiceStatus status = SlotServiceStatus.ACTIVE;
}
