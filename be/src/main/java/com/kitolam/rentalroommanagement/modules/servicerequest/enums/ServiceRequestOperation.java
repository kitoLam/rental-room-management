package com.kitolam.rentalroommanagement.modules.servicerequest.enums;

/** Actions the current user may perform, so the client does not re-implement the state machine. */
public enum ServiceRequestOperation {
    REGISTER,
    STOP,
    CANCEL,
    APPROVE,
    REJECT,
    CONFIRM_INSTALLATION,
    CONFIRM_TERMINATION
}
