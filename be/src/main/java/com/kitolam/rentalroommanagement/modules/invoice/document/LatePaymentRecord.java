package com.kitolam.rentalroommanagement.modules.invoice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.invoice.enums.LatePaymentStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Lịch sử trễ hạn thanh toán của một kỳ hoá đơn (một hợp đồng, một tháng). Mỗi kỳ chỉ có tối đa
 * một bản ghi; firstOverdueDate là ngày đầu tiên kỳ đó bị xem là quá hạn, lateDays là số ngày trễ
 * tính tới lastEvaluatedAt (job cập nhật mỗi ngày) hoặc tới khi tất toán (settledAt).
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "late_payment_records")
@CompoundIndex(name = "late_payment_period_uq", def = "{'contractId': 1, 'period': 1}", unique = true)
public class LatePaymentRecord extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String invoiceId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    private String roomNumber;

    private String tenantName;

    private String invoiceNumber;

    /** yyyy-MM */
    private String period;

    private LocalDate dueDate;

    private LocalDate firstOverdueDate;

    /** Số ngày trễ lớn nhất đã ghi nhận cho kỳ này. */
    private long lateDays;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalAmount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal paidAmount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal remainingAmount;

    private LatePaymentStatus status = LatePaymentStatus.OPEN;

    /** Số lần đã gửi nhắc nhở (mỗi lần job nhắc thành công +1). */
    private int reminderCount;

    private Instant lastReminderAt;

    private Instant lastEvaluatedAt;

    private Instant settledAt;
}
