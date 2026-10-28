package com.kitolam.rentalroommanagement.modules.appointment.integration;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Read model supplied by the room/booking integration, never inferred from booking enum names.
 * Unit counts are disjoint and describe CURRENT effective occupancy/holds; expired temporary
 * holds must already be excluded by the source. ROOM has one unit; SLOT counts rentable slots.
 * A read alone does not guarantee availability at commit: create/approve must coordinate with
 * the official source and revalidate. No booking or payment writes belong to this boundary.
 */
public record ViewingRoomSnapshot(
        String roomId,
        String branchId,
        String roomNumber,
        String branchName,
        String publicContactPhone,
        boolean publicListing,
        boolean branchActive,
        boolean roomOperational,
        RentalMode rentalMode,
        int totalUnits,
        int occupiedUnits,
        int officiallyHeldUnits,
        int temporarilyHeldUnits,
        List<String> officialBookingIds,
        String sourceRevision,
        Instant observedAt
) {
    public ViewingRoomSnapshot {
        Objects.requireNonNull(roomId, "roomId");
        Objects.requireNonNull(branchId, "branchId");
        Objects.requireNonNull(rentalMode, "rentalMode");
        Objects.requireNonNull(sourceRevision, "sourceRevision");
        Objects.requireNonNull(observedAt, "observedAt");
        officialBookingIds = List.copyOf(officialBookingIds);
        if (totalUnits < 1 || occupiedUnits < 0 || officiallyHeldUnits < 0 || temporarilyHeldUnits < 0
                || (long) occupiedUnits + officiallyHeldUnits + temporarilyHeldUnits > totalUnits
                || (rentalMode == RentalMode.ROOM && totalUnits != 1)) {
            throw new IllegalArgumentException("Invalid viewing inventory unit counts");
        }
        if (officiallyHeldUnits > 0 && officialBookingIds.isEmpty()) {
            throw new IllegalArgumentException("Official holds require a booking reference");
        }
    }

    public int availableUnits() {
        return totalUnits - occupiedUnits - officiallyHeldUnits - temporarilyHeldUnits;
    }

    public enum RentalMode { ROOM, SLOT }
}
