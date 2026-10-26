package com.kitolam.rentalroommanagement.modules.reportrecord.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "report_records")
public class ReportRecord extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String reportRequestId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String managerId;

    private ReportRecordAction action;

    private ReportRequestStatus statusFrom;

    private ReportRequestStatus statusTo;

    private String note;

    private List<String> attachments = new ArrayList<>();
}
