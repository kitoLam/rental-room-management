package com.kitolam.rentalroommanagement.modules.contract.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "contracts")
public class Contract extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Field(targetType = FieldType.OBJECT_ID)
    private List<String> roomSlotIds = new ArrayList<>();

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String bookingId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Field(write = Field.Write.ALWAYS)
    private String landlordName;
    @Field(write = Field.Write.ALWAYS)
    private String landlordIdNumber;
    @Field(write = Field.Write.ALWAYS)
    private String landlordAddress;
    @Field(write = Field.Write.ALWAYS)
    private String landlordDateOfBirth;
    @Field(write = Field.Write.ALWAYS)
    private String landlordIdIssueDate;
    @Field(write = Field.Write.ALWAYS)
    private String landlordIdIssuePlace;
    @Field(write = Field.Write.ALWAYS)
    private String landlordPhone;

    private String tenantName;
    @Field(write = Field.Write.ALWAYS)
    private String tenantIdNumber;
    @Field(write = Field.Write.ALWAYS)
    private String tenantAddress;
    @Field(write = Field.Write.ALWAYS)
    private String tenantDateOfBirth;
    @Field(write = Field.Write.ALWAYS)
    private String tenantIdIssueDate;
    @Field(write = Field.Write.ALWAYS)
    private String tenantIdIssuePlace;
    @Field(write = Field.Write.ALWAYS)
    private String tenantPhone;

    private String roomAddress;

    @Field(write = Field.Write.ALWAYS)
    private String signingAddress;

    @Field(write = Field.Write.ALWAYS)
    private String paymentMethod;

    @Field(targetType = FieldType.DECIMAL128, write = Field.Write.ALWAYS)
    private BigDecimal electricityRate;

    @Field(targetType = FieldType.DECIMAL128, write = Field.Write.ALWAYS)
    private BigDecimal waterRate;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String managerId;

    @Indexed
    private String contractNumber;

    private LocalDate startDate;

    private LocalDate endDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal rentPrice;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal contractDepositAmount;

    private Integer maxOccupants;

    private List<ContractServiceSnapshot> services = new ArrayList<>();

    /** Optional services in use, managed through slot service requests. */
    private List<ActiveSlotService> activeSlotServices = new ArrayList<>();

    private Integer paymentDueDay;

    private String terms;

    private String signedFileUrl;

    private String signedEvidenceUrl;

    private Integer termMonths;

    @Field(write = Field.Write.ALWAYS)
    private LocalDate signedDate;

    private LocalDate firstBillingStartDate;

    private Instant evidenceSubmittedAt;

    private Instant evidenceDeadline;

    private Integer evidenceResubmissionCount = 0;

    private String evidenceNote;

    private List<ContractEvidenceHistoryEntry> evidenceHistory = new ArrayList<>();

    @Field("contractUrl")
    private String contractUrl;

    private String pdfRevision;
    private String pdfPublicId;
    private Instant pdfNextAttemptAt;

    /** Hợp đồng gốc đã được gia hạn để tạo ra hợp đồng này (null nếu không phải hợp đồng nối tiếp). */
    @Indexed
    private String renewedFromContractId;

    /** Hợp đồng nối tiếp được tạo từ hợp đồng này (null nếu chưa gia hạn); dùng để chặn gia hạn hai lần. */
    private String renewedToContractId;

    /** Các mốc (số ngày còn lại: 45/30/21/14) đã gửi thông báo sắp hết hạn cho tenant — tránh gửi trùng. */
    private List<Integer> expiryNotifiedMilestones = new ArrayList<>();

    private Instant terminatedAt;

    private String terminationReason;

    private ContractStatus status = ContractStatus.DRAFT;
}
