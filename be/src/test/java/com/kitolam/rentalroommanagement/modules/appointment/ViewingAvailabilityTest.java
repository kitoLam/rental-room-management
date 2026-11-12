package com.kitolam.rentalroommanagement.modules.appointment;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.Actor;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.exception.exceptions.*;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.integration.*;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.ViewingAvailabilityResponse.Reason;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentServiceImpl;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import com.kitolam.rentalroommanagement.modules.shift.service.ShiftService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ViewingAvailabilityTest {
    private static final String ROOM = "710000000000000000000001";
    private static final String SLOT = "740000000000000000000001";
    private static final String BRANCH = "700000000000000000000001";
    private static final LocalDate DAY = LocalDate.of(2026, 10, 28);
    private static final Instant NOW = Instant.parse("2026-10-27T23:00:00Z"); // 06:00 VN
    private AppointmentRepository appointments;
    private AppointmentAccessService security;
    private ShiftService shifts;
    private ViewingInventoryGateway inventory;
    private AppointmentServiceImpl service;
    private Shift schedule;

    @BeforeEach
    void setup() {
        appointments = mock(AppointmentRepository.class);
        security = mock(AppointmentAccessService.class);
        shifts = mock(ShiftService.class);
        inventory = mock(ViewingInventoryGateway.class);
        when(inventory.slotsForViewing(eq(ROOM), any())).thenReturn(List.of(new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot(
                SLOT, "S01", com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.AVAILABLE,
                true, true, null, "AVAILABLE", null)));
        when(inventory.getRoom(ROOM)).thenReturn(new ViewingRoomSnapshot(ROOM, BRANCH, "101", "Branch", "0900000000",
                true, true, true, ViewingRoomSnapshot.RentalMode.ROOM, 1, 0, 0, 0, List.of(), "1", NOW));
        when(security.currentAccount()).thenReturn(Optional.empty());
        schedule = new Shift(); schedule.setId(ROOM); schedule.setRoomId(ROOM); schedule.setVersion(0L);
        schedule.setPeriods(List.of(new Shift.Period("730000000000000000000001", ShiftType.MORNING, "08:00", "10:00", true),
                new Shift.Period("730000000000000000000002", ShiftType.AFTERNOON, "14:00", "16:00", true),
                new Shift.Period("730000000000000000000003", ShiftType.EVENING, "18:00", "20:00", true)));
        when(shifts.getForRoom(ROOM)).thenReturn(schedule);
        service = new AppointmentServiceImpl(appointments, security, inventory, shifts, Clock.fixed(NOW, ZoneOffset.UTC),
                org.mapstruct.factory.Mappers.getMapper(com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper.class),
                new com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport(security),
                mock(com.kitolam.rentalroommanagement.modules.notification.service.NotificationService.class));
    }

    @Test
    void evenOneSlotMustBeExplicitlySelected() {
        var result = service.viewingAvailability(ROOM, DAY, List.of());
        assertTrue(result.periods().stream().allMatch(p -> p.reason() == Reason.NO_SLOT_SELECTED && !p.available()));
        assertNotNull(result.selectionError());
    }

    @Test
    void anotherSlotCanBeViewedInTheSamePeriodButAnOverlappingSlotCannot() {
        var existing = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.CONFIRMED, "08:00", "10:00");
        existing.setRoomSlotIds(List.of("740000000000000000000002"));
        when(appointments.findByRoomIdAndAppointmentDateAndIsDeletedFalse(ROOM, DAY)).thenReturn(List.of(existing));
        assertTrue(service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().getFirst().available());
        existing.setRoomSlotIds(List.of(SLOT));
        assertEquals(Reason.ROOM_TAKEN, service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().getFirst().reason());
    }

    @Test
    void foreignSlotsAndDisabledRoomViewingCannotBeUsed() {
        assertThrows(BadRequestException.class, () -> service.viewingAvailability(ROOM, DAY, List.of("740000000000000000000099")));
        schedule.setViewingEnabled(false);
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT));
        assertFalse(result.room().canReceiveRequest());
        assertTrue(result.periods().stream().noneMatch(p -> p.available()));
    }

    @Test
    void aSingleBlockedSlotPreventsTheWholeMultiSlotRequest() {
        when(inventory.slotsForViewing(eq(ROOM), any())).thenReturn(List.of(
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot(SLOT, "S01",
                        com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.AVAILABLE, true, true, DAY, "AVAILABLE", null),
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot("740000000000000000000002", "S02",
                        com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.OCCUPIED, true, false, DAY.plusDays(1), "SLOT_OCCUPIED", "S02 chỉ có thể xem từ ngày mai")));
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT, "740000000000000000000002"));
        assertTrue(result.periods().stream().allMatch(p -> p.reason() == Reason.SLOT_UNAVAILABLE));
        assertTrue(result.selectionError().contains("S02"));
    }

    @Test
    void createRequiresSlotsAndPersistsTheirIdsAndDisplayCodes() {
        signIn();
        String secondSlot = "740000000000000000000002";
        when(inventory.slotsForViewing(eq(ROOM), any())).thenReturn(List.of(
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot(secondSlot, "S02",
                        com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.AVAILABLE, true, true, DAY, "AVAILABLE", null),
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot(SLOT, "S01",
                        com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.AVAILABLE, true, true, DAY, "AVAILABLE", null)));
        var old = new com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest(
                ROOM, schedule.getPeriods().getFirst().id(), DAY, 0L, "Người xem", "0901234567");
        assertThrows(BadRequestException.class, () -> service.create(old, "no-slot"));
        when(appointments.withCreationGuards(anyString(), anyString(), anyString(), any()))
                .thenAnswer(call -> ((java.util.function.Supplier<?>) call.getArgument(3)).get());
        when(appointments.insert(any(Appointment.class))).thenAnswer(call -> call.getArgument(0));
        var input = new com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest(
                ROOM, schedule.getPeriods().getFirst().id(), DAY, 0L, "Người xem", "0901234567", List.of(secondSlot, SLOT));
        var response = service.create(input, "with-slot");
        assertEquals(List.of(SLOT, secondSlot), response.roomSlotIds());
        assertEquals(List.of("S01", "S02"), response.slotCodes());
        assertEquals(AppointmentStatus.PENDING, response.status());
    }

    @Test
    void approvalRevalidatesSlotDatesEvenWhenTheyWereValidAtSubmission() {
        when(security.currentAccount()).thenReturn(Optional.of(new Actor(new AuthPrincipal("owner", "owner@example.test", null,
                Role.OWNER.name(), true, "Owner", null), null, Set.of(BRANCH))));
        var pending = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.PENDING, "08:00", "10:00");
        pending.setId("750000000000000000000001"); pending.setBranchId(BRANCH); pending.setRoomSlotIds(List.of(SLOT));
        when(appointments.findByIdAndIsDeletedFalse(pending.getId())).thenReturn(Optional.of(pending));
        when(inventory.slotsForViewing(eq(ROOM), any())).thenReturn(List.of(
                new com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot(SLOT, "S01",
                        com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.OCCUPIED,
                        true, false, DAY.plusDays(1), "SLOT_OCCUPIED", "Slot chỉ có thể xem từ ngày mai")));
        assertThrows(ConflictException.class, () -> service.approve(pending.getId(),
                new com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentActionRequest.Approval(0L)));
        verify(appointments, never()).applyAction(any(), any(), anyLong(), any(), any(), any());
    }

    @Test
    void guestSeesThreeVietnamesePeriodsWithoutAnyIdentitiesOrPersonalLookups() {
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT));
        assertEquals(3, result.periods().size());
        assertTrue(result.periods().stream().allMatch(p -> p.available()));
        assertEquals(Instant.parse("2026-10-28T01:00:00Z"), result.periods().getFirst().startAt());
        assertEquals("Asia/Ho_Chi_Minh", result.timeZone());
        verify(appointments, never()).findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse(any(), any());
    }

    @Test
    void bookedHoursStillBlockOverlappingNewPeriodAfterConfigurationChanges() {
        var existing = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.CONFIRMED, "09:00", "15:00");
        when(appointments.findByRoomIdAndAppointmentDateAndIsDeletedFalse(ROOM, DAY)).thenReturn(List.of(existing));
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT));
        assertEquals(Reason.ROOM_TAKEN, result.periods().get(0).reason());
        assertEquals(Reason.ROOM_TAKEN, result.periods().get(1).reason());
        assertTrue(result.periods().get(2).available());
    }

    @Test
    void expiredPendingDoesNotHoldAtExactDeadlineButConfirmedDoes() {
        var pending = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.PENDING, "08:00", "10:00");
        pending.setExpiresAt(NOW);
        when(appointments.findByRoomIdAndAppointmentDateAndIsDeletedFalse(ROOM, DAY)).thenReturn(List.of(pending));
        assertTrue(service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().getFirst().available());
        pending.setStatus(AppointmentStatus.CONFIRMED);
        assertFalse(service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().getFirst().available());
    }

    @Test
    void sameTenantSameTypeIsBlockedEvenWhenActualHoursDoNotOverlap() {
        signIn();
        var own = appointment("other-room", ShiftType.MORNING, AppointmentStatus.PENDING, "11:00", "12:00");
        own.setExpiresAt(NOW.plusSeconds(3600));
        when(appointments.findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse("account", DAY)).thenReturn(List.of(own));
        assertEquals(Reason.TENANT_SAME_TYPE, service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().getFirst().reason());
    }

    @Test
    void differentTypesStillBlockActualOverlapButAdjacentPeriodsAreAllowed() {
        signIn();
        var own = appointment("other-room", ShiftType.EVENING, AppointmentStatus.CONFIRMED, "09:00", "14:00");
        when(appointments.findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse("account", DAY)).thenReturn(List.of(own));
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT));
        assertEquals(Reason.TENANT_TIME_OVERLAP, result.periods().getFirst().reason());
        assertTrue(result.periods().get(1).available());
    }

    @Test
    void completedAndNoShowPreventAnotherSameRoomDayRequestButCancelledDoesNot() {
        signIn();
        var own = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.COMPLETED, "08:00", "10:00");
        when(appointments.findByRequesterAccountIdAndAppointmentDateAndIsDeletedFalse("account", DAY)).thenReturn(List.of(own));
        assertEquals(Reason.TENANT_ROOM_DAY, service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().get(1).reason());
        own.setStatus(AppointmentStatus.NO_SHOW);
        assertEquals(Reason.TENANT_ROOM_DAY, service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().get(1).reason());
        own.setStatus(AppointmentStatus.CANCELLED);
        assertTrue(service.viewingAvailability(ROOM, DAY, List.of(SLOT)).periods().get(1).available());
    }

    @Test
    void alreadyStartedPeriodCannotBeTakenAndFutureHorizonIsUnbounded() {
        service = new AppointmentServiceImpl(appointments, security, inventory, shifts,
                Clock.fixed(Instant.parse("2026-10-28T01:00:00Z"), ZoneOffset.UTC),
                org.mapstruct.factory.Mappers.getMapper(com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper.class),
                new com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport(security),
                mock(com.kitolam.rentalroommanagement.modules.notification.service.NotificationService.class));
        var result = service.viewingAvailability(ROOM, DAY, List.of(SLOT));
        assertEquals(Reason.STARTED, result.periods().getFirst().reason());
        assertTrue(result.periods().get(1).available());
    }

    @Test
    void dateInPastIsRejectedAndFarFutureIsAllowed() {
        assertThrows(BadRequestException.class, () -> service.viewingAvailability(ROOM, DAY.minusDays(1), List.of(SLOT)));
        assertTrue(service.viewingAvailability(ROOM, DAY.plusYears(20), List.of(SLOT)).periods().stream().allMatch(p -> p.available()));
    }

    @Test
    void guestCannotReadOrChangeConfiguration() {
        assertThrows(UnauthorizedException.class, () -> service.shiftConfiguration(ROOM));
        assertThrows(UnauthorizedException.class, () -> service.updateShiftConfiguration(ROOM, null));
        verifyNoInteractions(shifts);
    }

    @Test
    void editingConfigurationReturnsAffectedAppointmentsWithoutWritingTheirSnapshots() {
        when(security.currentAccount()).thenReturn(Optional.of(new Actor(new AuthPrincipal("owner", "account@example.test", null, Role.OWNER.name(), true, "Owner", null), null, Set.of(BRANCH))));
        var existing = appointment(ROOM, ShiftType.MORNING, AppointmentStatus.CONFIRMED, "08:00", "10:00");
        existing.setId("appointment");
        when(appointments.findByRoomIdAndAppointmentDateGreaterThanEqualAndIsDeletedFalse(ROOM, DAY)).thenReturn(List.of(existing));
        Shift changed = new Shift(); changed.setRoomId(ROOM); changed.setVersion(1L);
        changed.setPeriods(List.of(new Shift.Period(schedule.getPeriods().getFirst().id(), ShiftType.MORNING, "09:00", "11:00", false),
                schedule.getPeriods().get(1), schedule.getPeriods().get(2)));
        var input = new ShiftUpdateRequest(0L, List.of());
        when(shifts.updateForRoom(ROOM, input)).thenReturn(changed);
        var result = service.updateShiftConfiguration(ROOM, input);
        assertEquals(1, result.existingAppointments().size());
        assertEquals(Instant.parse("2026-10-28T01:00:00Z"), existing.getStartAt());
        assertEquals(AppointmentStatus.CONFIRMED, existing.getStatus());
        verify(appointments, never()).save(any());
    }

    private void signIn() {
        when(security.currentAccount()).thenReturn(Optional.of(new Actor(new AuthPrincipal("account", "account@example.test", null, Role.TENANT.name(), true, "User", null), null, Set.of())));
    }

    private Appointment appointment(String room, ShiftType type, AppointmentStatus status, String start, String end) {
        Appointment a = new Appointment(); a.setRoomId(room); a.setAppointmentDate(DAY); a.setShiftType(type);
        a.setShiftId(schedule.getPeriods().get(type.ordinal()).id()); a.setStatus(status);
        a.setStartAt(DAY.atTime(LocalTime.parse(start)).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        a.setEndAt(DAY.atTime(LocalTime.parse(end)).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        return a;
    }
}
