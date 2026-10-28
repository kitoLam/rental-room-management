package com.kitolam.rentalroommanagement.modules.shift.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import java.util.List;

/** One atomic configuration per room; _id is the room ID. */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "shifts")
public class Shift extends BaseDocument {
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;
    @Version
    private Long version;
    private List<Period> periods;

    public record Period(String id, ShiftType type, String startTime, String endTime, boolean isActive) { }
}
