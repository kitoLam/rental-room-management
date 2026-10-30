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

import java.time.Instant;
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

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String managerId;

    private ReportRequestType type;

    private String title;

    private String content;

    private List<String> attachments = new ArrayList<>();

    private ReportRequestPriority priority = ReportRequestPriority.MEDIUM;

    private String rejectReason;

    private String requestedInfoNote;

    private String solutionResult;

    private String disputeReason;

    private String adminConclusion;

    private ReportRequestStatus status = ReportRequestStatus.PENDING;

    private Instant resolvedAt;

    private Instant closedAt;
}
