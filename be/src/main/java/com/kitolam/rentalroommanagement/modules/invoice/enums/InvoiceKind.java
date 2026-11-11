package com.kitolam.rentalroommanagement.modules.invoice.enums;

public enum InvoiceKind {
    /** The one regular invoice of a contract for a month. */
    MONTHLY,
    /** Extra invoice for the same month, holding only what earlier issued invoices did not bill yet. */
    SUPPLEMENTARY
}
