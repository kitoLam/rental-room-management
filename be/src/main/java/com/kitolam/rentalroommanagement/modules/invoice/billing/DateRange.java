package com.kitolam.rentalroommanagement.modules.invoice.billing;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Half-open date interval [from, to). A null end means "open ended". */
public record DateRange(LocalDate from, LocalDate to) {

    public static DateRange of(LocalDate from, LocalDate toOrNull) {
        return new DateRange(from, toOrNull == null ? LocalDate.MAX : toOrNull);
    }

    /** Whole days in the interval; 0 when empty. */
    public long days() {
        return isEmpty() ? 0 : ChronoUnit.DAYS.between(from, to);
    }

    public boolean isEmpty() {
        return !from.isBefore(to);
    }

    /** overlap(a, b) = [max(starts), min(ends)); may be empty. */
    public DateRange intersect(DateRange other) {
        LocalDate start = from.isAfter(other.from) ? from : other.from;
        LocalDate end = to.isBefore(other.to) ? to : other.to;
        return new DateRange(start, end);
    }

    /** Last day included in the interval, for display. */
    public LocalDate lastDay() {
        return to.minusDays(1);
    }
}
