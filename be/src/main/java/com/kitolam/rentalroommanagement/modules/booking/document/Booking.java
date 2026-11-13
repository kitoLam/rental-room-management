package com.kitolam.rentalroommanagement.modules.booking.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
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
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "bookings")
public class Booking extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String tenantId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomSlotId;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private List<String> roomSlotIds = new ArrayList<>();

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String contractId;

    /** One contract per booked slot, created once the deposit is paid. contractId = the first one. */
    @Field(targetType = FieldType.OBJECT_ID)
    private List<String> contractIds = new ArrayList<>();

    private LocalDate expectedMoveInDate;

    private LocalDate expectedMoveOutDate;

    /** Slot start dates fixed when the booking is created. Null for existing bookings. */
    private Map<String, LocalDate> slotMoveInDates;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal holdingDepositAmount;

    private Instant paymentDeadline;

    private List<SelectedServiceSnapshot> selectedServices = new ArrayList<>();

    private Instant holdExpiresAt;

    private Instant checkInDeadline;

    private String cancellationPolicy;

    private DepositStatus depositStatus = DepositStatus.UNPAID;

    private String rejectReason;

    private Instant termsAcceptedAt;

    private List<BookingTimelineEntry> timeline = new ArrayList<>();

    private BookingStatus status = BookingStatus.REQUESTED;
}
