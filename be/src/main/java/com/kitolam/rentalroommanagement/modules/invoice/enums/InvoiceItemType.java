package com.kitolam.rentalroommanagement.modules.invoice.enums;

public enum InvoiceItemType {
    /** Phí 1: rent, prorated by the days lived in the month. */
    ROOM_RENT,
    /** Phí 2: room services (per room), split by the number of occupants in the month. */
    ROOM_SERVICE,
    /** Legacy (per-person room services no longer exist); kept so old invoices still load. */
    PERSONAL_SERVICE,
    /** Phí 4: room electricity (meter reading), split by the number of occupants in the month. */
    ELECTRICITY,
    /** Phí 5: optional slot services used at any time in the month (each registration counts). */
    SLOT_SERVICE,
    DEPOSIT,
    PENALTY,
    OTHER
}
