package com.kitolam.rentalroommanagement.modules.roomslot;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.kitolam.rentalroommanagement.modules.roomslot.service.support.RoomSlotAvailabilityRoller;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RoomSlotAvailabilityRollerTest {

    @Test
    void rollsOneWeekWhenAvailableFromIsYesterday() {
        assertEquals(LocalDate.of(2026, 12, 8),
                RoomSlotAvailabilityRoller.rollForward(LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 2)));
    }

    @Test
    void keepsAvailableFromWhenItIsToday() {
        assertEquals(LocalDate.of(2026, 12, 2),
                RoomSlotAvailabilityRoller.rollForward(LocalDate.of(2026, 12, 2), LocalDate.of(2026, 12, 2)));
    }

    @Test
    void keepsAvailableFromWhenItIsInTheFuture() {
        assertEquals(LocalDate.of(2026, 12, 30),
                RoomSlotAvailabilityRoller.rollForward(LocalDate.of(2026, 12, 30), LocalDate.of(2026, 11, 10)));
    }

    @Test
    void keepsRollingUntilItIsNoLongerInThePast() {
        assertEquals(LocalDate.of(2027, 1, 5),
                RoomSlotAvailabilityRoller.rollForward(LocalDate.of(2026, 12, 1), LocalDate.of(2027, 1, 5)));
    }

    @Test
    void leavesMissingAvailableFromMissing() {
        assertEquals(null, RoomSlotAvailabilityRoller.rollForward(null, LocalDate.of(2026, 11, 10)));
    }

    @Test
    void releaseDateIsTwoWeeksBeforeOccupancyEnd() {
        assertEquals(LocalDate.of(2026, 12, 1),
                RoomSlotAvailabilityRoller.releaseDate(LocalDate.of(2026, 12, 15)));
    }

    @Test
    void occupancyWithUnknownEndNeverReleases() {
        assertEquals(null, RoomSlotAvailabilityRoller.releaseDate(null));
    }

    @Test
    void slotIsReleasableOnceRequestedStartReachesReleaseDate() {
        LocalDate end = LocalDate.of(2026, 12, 15);
        // Ngày 1/12 là mốc nhả -> đặt mới từ 1/12 trở đi được coi là trống.
        assertEquals(true, RoomSlotAvailabilityRoller.releasesBefore(end, LocalDate.of(2026, 12, 1)));
        assertEquals(true, RoomSlotAvailabilityRoller.releasesBefore(end, LocalDate.of(2027, 1, 5)));
        // Trước mốc nhả thì lượt ở vẫn chặn.
        assertEquals(false, RoomSlotAvailabilityRoller.releasesBefore(end, LocalDate.of(2026, 11, 30)));
        assertEquals(false, RoomSlotAvailabilityRoller.releasesBefore(end, LocalDate.of(2026, 11, 10)));
    }
}