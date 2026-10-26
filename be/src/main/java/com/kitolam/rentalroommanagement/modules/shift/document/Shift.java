package com.kitolam.rentalroommanagement.modules.shift.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.DayOfWeek;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "shifts")
public class Shift extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    private String name;

    private Set<DayOfWeek> daysOfWeek;

    private String startTime;

    private String endTime;

    private Integer maxAppointments;

    private Boolean isActive = true;
}
