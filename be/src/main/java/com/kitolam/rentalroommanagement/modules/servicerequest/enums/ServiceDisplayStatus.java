package com.kitolam.rentalroommanagement.modules.servicerequest.enums;

/** State of one catalog service from the tenant's point of view (state diagram labels in comments). */
public enum ServiceDisplayStatus {
    /** Chưa đăng ký. */
    AVAILABLE,
    /** Chờ duyệt. */
    PENDING,
    /** Đã duyệt, chờ xác nhận lắp đặt. */
    APPROVED,
    /** Đang sử dụng. */
    ACTIVE,
    /** Chờ ngừng. */
    STOP_PENDING
}
