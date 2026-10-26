package com.kitolam.rentalroommanagement.modules.appointment.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
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
@Document(collection = "appointments")
public class Appointment extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String shiftId;

    private LocalDate appointmentDate;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String proposedShiftId;

    private LocalDate proposedDate;

    private String note;

    private String rejectReason;

    private String result;

    private AppointmentStatus status = AppointmentStatus.PENDING;
}
