package com.kitolam.rentalroommanagement.modules.reportrequest.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
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
@Document(collection = "report_requests")
public class ReportRequest extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    private ReportRequestType type;

    private String title;

    private String content;

    private List<String> attachments = new ArrayList<>();

    private ReportRequestPriority priority = ReportRequestPriority.MEDIUM;

    private String rejectReason;

    private ReportRequestStatus status = ReportRequestStatus.PENDING;
}
