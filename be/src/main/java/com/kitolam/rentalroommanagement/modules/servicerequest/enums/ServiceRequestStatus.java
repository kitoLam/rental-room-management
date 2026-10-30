package com.kitolam.rentalroommanagement.modules.servicerequest.enums;

/**
 * REGISTER: PENDING → APPROVED → COMPLETED (installation confirmed), or REJECTED / CANCELLED.
 * STOP:     PENDING → COMPLETED (end date confirmed), or REJECTED / CANCELLED.
 */
public enum ServiceRequestStatus {
    PENDING,
    APPROVED,
    COMPLETED,
    REJECTED,
    CANCELLED
}
