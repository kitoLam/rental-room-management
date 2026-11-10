package com.kitolam.rentalroommanagement.modules.invoice.enums;

public enum InvoiceItemType {
    ROOM_RENT,
    ROOM_SERVICE,
    SLOT_SERVICE,
    DEPOSIT,
    PENALTY,
    OTHER,
    DISCOUNT;

    /** Items computed by invoice generation; everything else is added manually and kept on regeneration. */
    public boolean isGenerated() {
        return this == ROOM_RENT || this == ROOM_SERVICE || this == SLOT_SERVICE;
    }
}
