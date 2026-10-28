package com.kitolam.rentalroommanagement.modules.appointment;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingEligibilityResponse.Reason;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingInventoryGateway;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot.RentalMode;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentServiceImpl;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ViewingDependenciesTest {
    private static final String BRANCH = "700000000000000000000001";
    private static final String ROOM = "710000000000000000000001";
    private AppointmentAccessService security;
    private ViewingInventoryGateway inventory;
    private AppointmentServiceImpl service;

    @BeforeEach
    void setUp() {
        security = mock(AppointmentAccessService.class);
        inventory = mock(ViewingInventoryGateway.class);
        service = new AppointmentServiceImpl(mock(AppointmentRepository.class), security, inventory, mock(com.kitolam.rentalroommanagement.modules.shift.service.ShiftService.class), java.time.Clock.systemUTC(),
                org.mapstruct.factory.Mappers.getMapper(com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper.class),
                new com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport(security),
                mock(com.kitolam.rentalroommanagement.modules.notification.service.NotificationService.class));
    }

    @Test
    void guestCanInspectPublicEligibilityWithoutAnIdentity() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.ROOM, 1, 0, 0, 0, true, true, true));
        assertTrue(service.publicRoomEligibility(ROOM).canReceiveRequest());
        verifyNoInteractions(security);
    }

    @Test
    void oneOfficiallyHeldSlotDoesNotBlockRemainingFreeSlot() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.SLOT, 4, 2, 1, 0, true, true, true));
        assertEquals(Reason.AVAILABLE, service.publicRoomEligibility(ROOM).reason());
    }

    @Test
    void lastSlotTemporarilyHeldIsDifferentFromAnOfficialHold() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.SLOT, 4, 2, 1, 1, true, true, true));
        assertEquals(Reason.TEMPORARY_HOLD, service.publicRoomEligibility(ROOM).reason());
        assertFalse(service.publicRoomEligibility(ROOM).canReceiveRequest());
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.SLOT, 4, 2, 2, 0, true, true, true));
        assertEquals(Reason.OFFICIAL_HOLD, service.publicRoomEligibility(ROOM).reason());
    }

    @Test
    void occupiedRoomIsUnavailableRegardlessOfAFutureViewingDate() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.ROOM, 1, 1, 0, 0, true, true, true));
        assertEquals(Reason.NO_VACANCY, service.publicRoomEligibility(ROOM).reason());
    }

    @Test
    void expiredTemporaryHoldMustBeAbsentFromTheSourceSnapshot() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.ROOM, 1, 0, 0, 1, true, true, true),
                room(RentalMode.ROOM, 1, 0, 0, 0, true, true, true));
        assertEquals(Reason.TEMPORARY_HOLD, service.publicRoomEligibility(ROOM).reason());
        assertTrue(service.publicRoomEligibility(ROOM).canReceiveRequest());
    }

    @Test
    void branchAndRoomOperationalStateOverrideVacancy() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.SLOT, 4, 0, 0, 0, true, false, true));
        assertEquals(Reason.BRANCH_INACTIVE, service.publicRoomEligibility(ROOM).reason());
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.SLOT, 4, 0, 0, 0, true, true, false));
        assertEquals(Reason.ROOM_UNAVAILABLE, service.publicRoomEligibility(ROOM).reason());
    }

    @Test
    void privateListingIsNotExposedToGuests() {
        when(inventory.getRoom(ROOM)).thenReturn(room(RentalMode.ROOM, 1, 0, 0, 0, false, true, true));
        assertThrows(NotFoundException.class, () -> service.publicRoomEligibility(ROOM));
    }

    @Test
    void inconsistentSourceCountsFailInsteadOfMakingInventoryAvailable() {
        assertThrows(IllegalArgumentException.class,
                () -> room(RentalMode.ROOM, 2, 0, 0, 0, true, true, true));
        assertThrows(IllegalArgumentException.class,
                () -> room(RentalMode.SLOT, 4, 2, 2, 1, true, true, true));
        assertThrows(IllegalArgumentException.class,
                () -> room(RentalMode.SLOT, 4, -1, 0, 0, true, true, true));
    }

    private ViewingRoomSnapshot room(RentalMode mode, int total, int occupied, int official,
                                      int temporary, boolean publicListing, boolean branchActive,
                                      boolean roomOperational) {
        return new ViewingRoomSnapshot(ROOM, BRANCH, "101", "Branch", "0900000000",
                publicListing, branchActive, roomOperational, mode, total, occupied, official,
                temporary, official > 0 ? List.of("official-booking") : List.of(), "revision-1",
                Instant.parse("2026-10-27T00:00:00Z"));
    }
}
