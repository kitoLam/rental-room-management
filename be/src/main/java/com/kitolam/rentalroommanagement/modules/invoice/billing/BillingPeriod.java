package com.kitolam.rentalroommanagement.modules.invoice.billing;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

/** Billing month: [first day of month, first day of next month). */
public record BillingPeriod(YearMonth month) {

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("MM/yyyy");

    public static BillingPeriod parse(String period) {
        return new BillingPeriod(YearMonth.parse(period));
    }

    public DateRange range() {
        return new DateRange(month.atDay(1), month.plusMonths(1).atDay(1));
    }

    public int days() {
        return month.lengthOfMonth();
    }

    /** yyyy-MM, as stored in Invoice.period. */
    public String code() {
        return month.toString();
    }

    /** MM/yyyy, for item descriptions. */
    public String label() {
        return month.format(LABEL);
    }
}
