package com.kitolam.rentalroommanagement.common.dto;

import java.time.Instant;

/** Immutable audit projection shared by read-only module interfaces. */
public record ActivitySnapshot(String id, String subjectId, String action, Instant at,
                               String actorAccountId, String actorName, String note) {
    public boolean within(Instant from, Instant to) {
        return at != null && !at.isBefore(from) && at.isBefore(to);
    }
}
