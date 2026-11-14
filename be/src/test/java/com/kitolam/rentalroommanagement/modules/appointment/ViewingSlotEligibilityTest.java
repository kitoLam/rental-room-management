package com.kitolam.rentalroommanagement.modules.appointment;

import com.kitolam.rentalroommanagement.modules.appointment.integration.DatabaseViewingInventoryGateway;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyList;

class ViewingSlotEligibilityTest {
    final RoomSlotService slots = mock(RoomSlotService.class);
    final RoomSlotOccupancyService occupancies = mock(RoomSlotOccupancyService.class);
    final ContractService contracts = mock(ContractService.class);
    final BookingService bookings = mock(BookingService.class);
    final LocalDate today = LocalDate.of(2026, 11, 12);
    final LocalDate end = LocalDate.of(2026, 12, 15);
    DatabaseViewingInventoryGateway inventory;

    @BeforeEach void setup() {
        inventory = new DatabaseViewingInventoryGateway(mock(RoomService.class), mock(BranchService.class), bookings,
                Clock.fixed(Instant.parse("2026-11-12T01:00:00Z"), ZoneOffset.UTC), slots, occupancies, contracts);
        when(slots.readForOverview(List.of("room"))).thenReturn(List.of(
                new RoomSlotService.OverviewSlot("slot", "room", "P.504-S01", RoomSlotStatus.OCCUPIED, null),
                new RoomSlotService.OverviewSlot("free", "room", "P.504-S02", RoomSlotStatus.AVAILABLE, null)));
    }
    void lease(LocalDate endDate) {
        when(contracts.readForOverview(anyList())).thenReturn(List.of(new ContractService.OverviewContract(
                "contract", "room", "tenant", "booking", "HD-1", ContractStatus.ACTIVE,
                today.minusMonths(1), endDate, null, List.of("slot"))));
    }
    @Test void viewingRequiresDateStrictlyAfterContractEndWhileOccupiedSlotRemainsSelectable() {
        lease(end);
        var before = inventory.slotsForViewing("room", end.minusDays(1)).getFirst();
        var equal = inventory.slotsForViewing("room", end).getFirst();
        var after = inventory.slotsForViewing("room", end.plusDays(1)).getFirst();
        assertTrue(before.selectable());
        assertFalse(before.available());
        assertFalse(equal.available());
        assertEquals(end.plusDays(1), equal.availableFrom());
        assertTrue(equal.message().contains("16/12/2026"));
        assertTrue(after.available());
        assertTrue(inventory.slotsForViewing("room", today).get(1).available());
    }
    @Test void occupiedSlotWithoutAnEndDateFailsClosedForFutureDates() {
        lease(null);
        var value = inventory.slotsForViewing("room", today.plusYears(3)).getFirst();
        assertTrue(value.selectable());
        assertFalse(value.available());
        assertNull(value.availableFrom());
    }
    @Test void futureApprovedLeaseBlocksBeforeMoveInAndThroughItsEndEvenIfSlotFlagIsAvailable() {
        futureLease(ContractStatus.ACTIVE, end);
        for (LocalDate date : List.of(today, today.plusDays(1), end)) {
            var value = inventory.slotsForViewing("room", date).get(1);
            assertTrue(value.selectable());
            assertFalse(value.available());
            assertEquals("SLOT_OCCUPIED", value.reason());
            assertEquals(end.plusDays(1), value.availableFrom());
            assertTrue(value.message().contains("16/12/2026"));
        }
        assertTrue(inventory.slotsForViewing("room", end.plusDays(1)).get(1).available());
    }
    @Test void futureApprovedLeaseWithoutEndDateDoesNotAllowAnEarlierViewing() {
        futureLease(ContractStatus.ACTIVE, null);
        assertFalse(inventory.slotsForViewing("room", today).get(1).available());
        var later = inventory.slotsForViewing("room", today.plusYears(2)).get(1);
        assertFalse(later.available());
        assertNull(later.availableFrom());
    }
    @Test void draftLeaseAloneDoesNotAllocateAnOtherwiseVacantSlot() {
        futureLease(ContractStatus.DRAFT, end);
        assertTrue(inventory.slotsForViewing("room", today).get(1).available());
    }
    @Test void multipleApprovedTermsBlockTheGapBeforeTheNextTermUntilTheLatestEnd() {
        when(contracts.readForOverview(anyList())).thenReturn(List.of(
                new ContractService.OverviewContract("first", "room", "tenant", "booking", "HD-1",
                        ContractStatus.ACTIVE, today.plusDays(1), end, null, List.of("free")),
                new ContractService.OverviewContract("next", "room", "tenant", "booking2", "HD-2",
                        ContractStatus.ACTIVE, end.plusDays(3), end.plusMonths(3), null, List.of("free"))));
        var gap = inventory.slotsForViewing("room", end.plusDays(1)).get(1);
        assertFalse(gap.available());
        assertEquals(end.plusMonths(3).plusDays(1), gap.availableFrom());
        assertTrue(inventory.slotsForViewing("room", end.plusMonths(3).plusDays(1)).get(1).available());
    }
    private void futureLease(ContractStatus status, LocalDate endDate) {
        when(contracts.readForOverview(anyList())).thenReturn(List.of(new ContractService.OverviewContract(
                "future", "room", "tenant", "booking", "HD-future", status,
                today.plusDays(1), endDate, null, List.of("free"))));
    }
    @Test void staleOccupiedFlagDoesNotBlockAfterAKnownLeaseHasEnded() {
        lease(today.minusDays(1));
        assertTrue(inventory.slotsForViewing("room", today).getFirst().available());
    }
    @Test void futureOccupancyStillBlocksTheSpecificDateAfterCurrentLeaseEnds() {
        lease(end);
        when(occupancies.readForOverview(anyList())).thenReturn(List.of(
                new RoomSlotOccupancyService.OverviewOccupancy("slot", null, null, end.plusDays(3), end.plusDays(10), OccupancyStatus.ACTIVE)));
        assertTrue(inventory.slotsForViewing("room", end.plusDays(1)).getFirst().available());
        assertFalse(inventory.slotsForViewing("room", end.plusDays(4)).getFirst().available());
        assertTrue(inventory.slotsForViewing("room", end.plusDays(11)).getFirst().available());
    }
    @Test void vacantSlotCanBeViewedBeforeMoveInDateButMaintenanceStillBlocks() {
        when(slots.readForOverview(List.of("room"))).thenReturn(List.of(
                new RoomSlotService.OverviewSlot("free", "room", "S01", RoomSlotStatus.AVAILABLE, end),
                new RoomSlotService.OverviewSlot("maintenance", "room", "S02", RoomSlotStatus.MAINTENANCE, null)));
        assertTrue(inventory.slotsForViewing("room", end.minusDays(1)).getFirst().available());
        assertTrue(inventory.slotsForViewing("room", end).getFirst().available());
        assertFalse(inventory.slotsForViewing("room", end.plusDays(1)).get(1).selectable());
    }
    @Test void expiredTemporaryHoldDoesNotBlockViewing() {
        when(bookings.readForOverview(anyList())).thenReturn(List.of(new BookingService.OverviewBooking(
                "hold", "tenant", "free", List.of("free"), null, today,
                Instant.parse("2026-11-11T23:00:00Z"), Instant.parse("2026-11-11T23:00:00Z"), null,
                com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.AWAITING_PAYMENT)));
        assertTrue(inventory.slotsForViewing("room", today).get(1).available());
    }

    @Test void currentTemporaryHoldBlocksEvenBeforeOrAfterItsReservedStayDates() {
        when(bookings.readForOverview(anyList())).thenReturn(List.of(hold("free", com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.AWAITING_PAYMENT)));
        when(occupancies.readForOverview(anyList())).thenReturn(List.of(new RoomSlotOccupancyService.OverviewOccupancy(
                "free", null, "hold", today.plusDays(10), end, OccupancyStatus.RESERVED)));
        assertFalse(inventory.slotsForViewing("room", today).get(1).available());
        assertFalse(inventory.slotsForViewing("room", end.plusYears(1)).get(1).available());
    }

    @Test void confirmedHoldWithoutKnownLeaseDatesCannotBeAssumedFree() {
        when(bookings.readForOverview(anyList())).thenReturn(List.of(hold("free", com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.CONFIRMED)));
        var result = inventory.slotsForViewing("room", today.plusYears(2)).get(1);
        assertFalse(result.available());
        assertEquals("SLOT_OFFICIAL_HOLD", result.reason());
        assertNull(result.availableFrom());
    }

    @Test void finishedLeasesAndEndedStaysDoNotReviveHistoricalConfirmedBooking() {
        when(bookings.readForOverview(anyList())).thenReturn(List.of(hold("free", com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.CONFIRMED)));
        when(contracts.readForOverview(anyList())).thenReturn(List.of(new ContractService.OverviewContract(
                "old", "room", "tenant", "hold", "HD-old", ContractStatus.TERMINATED, today.minusMonths(1), end, null, List.of("free"))));
        when(occupancies.readForOverview(anyList())).thenReturn(List.of(new RoomSlotOccupancyService.OverviewOccupancy(
                "free", "tenancy", "hold", today.minusMonths(1), end, OccupancyStatus.ENDED)));
        assertTrue(inventory.slotsForViewing("room", today).get(1).available());
    }

    @Test void confirmedReservationWithKnownLeaseEndAllowsOnlyFollowingDay() {
        when(bookings.readForOverview(anyList())).thenReturn(List.of(hold("free", com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.CONFIRMED)));
        when(contracts.readForOverview(anyList())).thenReturn(List.of(new ContractService.OverviewContract(
                "draft", "room", "tenant", "hold", "HD-new", ContractStatus.DRAFT, today.plusDays(3), end, null, List.of("free"))));
        assertFalse(inventory.slotsForViewing("room", today).get(1).available());
        assertFalse(inventory.slotsForViewing("room", end).get(1).available());
        assertTrue(inventory.slotsForViewing("room", end.plusDays(1)).get(1).available());
    }

    @Test void activeContractForOneSlotCannotReleaseAnotherSlotOfTheSameBooking() {
        lease(end);
        when(bookings.readForOverview(anyList())).thenReturn(List.of(new BookingService.OverviewBooking(
                "booking", "tenant", "slot", List.of("slot", "free"), "contract", today,
                null, null, null, com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.CONFIRMED)));
        assertTrue(inventory.slotsForViewing("room", end.plusDays(1)).getFirst().available());
        assertFalse(inventory.slotsForViewing("room", end.plusDays(1)).get(1).available());
    }

    private BookingService.OverviewBooking hold(String slot, com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus status) {
        return new BookingService.OverviewBooking("hold", "tenant", slot, List.of(slot), null, today.plusDays(3),
                Instant.parse("2026-11-13T01:00:00Z"), Instant.parse("2026-11-13T01:00:00Z"), null, status);
    }

    @Test void automationKeepsAValidFutureSlotViewingEvenWhenTheRoomIsOccupiedToday() {
        var repository = runAutomation(true);
        verify(repository, never()).applyAction(any(), any(), anyLong(), any(), any(), any());
    }

    @Test void automationLeavesLeaseConflictForManagerToCancelWithReason() {
        var repository = runAutomation(false);
        verify(repository, never()).applyAction(any(), any(), anyLong(), any(), any(), any());
    }

    @Test void automationStillCancelsForANewOfficialReservation() {
        var repository = runAutomation(false, "SLOT_OFFICIAL_HOLD");
        verify(repository).applyAction(any(), any(), anyLong(), any(), any(), any());
    }

    private com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository runAutomation(boolean selectedAvailable) {
        return runAutomation(selectedAvailable, selectedAvailable ? "AVAILABLE" : "SLOT_OCCUPIED");
    }

    private com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository runAutomation(boolean selectedAvailable, String reason) {
        var repository = mock(com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository.class);
        var source = mock(com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingInventoryGateway.class);
        var appointment = new com.kitolam.rentalroommanagement.modules.appointment.document.Appointment();
        appointment.setId("750000000000000000000001"); appointment.setRoomId("room"); appointment.setBranchId("branch");
        appointment.setRoomSlotIds(List.of("slot")); appointment.setRequesterAccountId("tenant");
        appointment.setAppointmentDate(end.plusDays(1)); appointment.setStartAt(end.plusDays(1).atTime(8, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        appointment.setStatus(com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus.CONFIRMED);
        when(repository.automationCandidates(isNull(), any(), eq(100))).thenReturn(List.of(appointment));
        when(repository.findByIdAndIsDeletedFalse(appointment.getId())).thenReturn(java.util.Optional.of(appointment));
        when(repository.withAutomationGuard(anyString(), any())).thenAnswer(call -> ((java.util.function.Supplier<?>) call.getArgument(1)).get());
        when(source.getRoom("room")).thenReturn(new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot(
                "room", "branch", "P.1", "Branch", null, true, true, true,
                com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot.RentalMode.SLOT,
                selectedAvailable ? 1 : 2, selectedAvailable ? 1 : 0, 0, 0, List.of(), "revision", Instant.parse("2026-11-12T01:00:00Z")));
        when(source.slotsForViewing("room", appointment.getAppointmentDate())).thenReturn(List.of(
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot("slot", "S01", RoomSlotStatus.OCCUPIED,
                        true, selectedAvailable, end.plusDays(1), reason, selectedAvailable ? null : "Slot chưa trống")));
        var automation = new com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentAutomationServiceImpl(repository, source,
                new com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport(
                        mock(com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.class)),
                mock(com.kitolam.rentalroommanagement.modules.notification.service.NotificationService.class),
                Clock.fixed(Instant.parse("2026-11-12T01:00:00Z"), ZoneOffset.UTC));
        automation.runCycle();
        return repository;
    }
}
