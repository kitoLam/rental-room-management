package com.kitolam.rentalroommanagement.modules.booking.document;

import java.time.Instant;

public record BookingTimelineEntry(String status, Instant at, String note) {
}
