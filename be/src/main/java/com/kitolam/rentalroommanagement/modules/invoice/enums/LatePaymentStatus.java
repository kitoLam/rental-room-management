package com.kitolam.rentalroommanagement.modules.invoice.enums;

/** Lifecycle of one late-payment period. The period is still open while the invoice is unpaid. */
public enum LatePaymentStatus {
    /** Đã trễ hạn, chưa thanh toán đủ. */
    OPEN,
    /** Đã thanh toán đủ; lateDays giữ lại số ngày trễ của kỳ. */
    SETTLED
}
