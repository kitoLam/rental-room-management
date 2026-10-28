package com.kitolam.rentalroommanagement.modules.appointment;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.Actor;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.exception.exceptions.*;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.integration.*;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentServiceImpl;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftBulkUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftBulkUpdateRequest.RoomVersion;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftBulkUpdateResponse.Status;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.impl.ShiftServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ViewingBranchBulkTest {
    private static final String BRANCH = "700000000000000000000001";
    private static final String OTHER_BRANCH = "700000000000000000000002";
    private static final String R1 = "710000000000000000000001";
    private static final String R2 = "710000000000000000000002";
    private static final String R3 = "710000000000000000000003";
    private static final String R4 = "710000000000000000000004";
    private final Map<String, Shift> stored = new HashMap<>();
    private AppointmentAccessService security;
    private ViewingInventoryGateway inventory;
    private ShiftRepository repository;
    private AppointmentRepository appointments;
    private AppointmentServiceImpl service;

    @BeforeEach
    void setup() {
        stored.clear();
        security = mock(AppointmentAccessService.class);
        inventory = mock(ViewingInventoryGateway.class);
        repository = mock(ShiftRepository.class);
        appointments = mock(AppointmentRepository.class);
        signIn(true, Set.of(BRANCH));
        when(inventory.getRoom(anyString())).thenAnswer(call -> {
            String id = call.getArgument(0);
            if (!List.of(R1, R2, R3, R4).contains(id)) throw new NotFoundException("Không tìm thấy phòng");
            return room(id, id.equals(R4) ? OTHER_BRANCH : BRANCH);
        });
        when(inventory.roomsInBranch(eq(BRANCH), any())).thenAnswer(call -> {
            Pageable p = call.getArgument(1);
            var all = List.of(room(R1, BRANCH), room(R2, BRANCH), room(R3, BRANCH));
            int start = (int) Math.min(p.getOffset(), all.size());
            return new PageImpl<>(all.subList(start, Math.min(start + p.getPageSize(), all.size())), p, all.size());
        });
        for (String id : List.of(R1, R2, R3)) stored.put(id, schedule(id));
        when(repository.findByIdAndIsDeletedFalse(anyString())).thenAnswer(call -> Optional.ofNullable(copy(stored.get(call.getArgument(0)))));
        when(repository.save(any(Shift.class))).thenAnswer(call -> {
            Shift incoming = call.getArgument(0);
            if (!incoming.getVersion().equals(stored.get(incoming.getRoomId()).getVersion()))
                throw new OptimisticLockingFailureException("stale");
            incoming.setVersion(incoming.getVersion() + 1);
            stored.put(incoming.getRoomId(), copy(incoming));
            return incoming;
        });
        service = new AppointmentServiceImpl(appointments, security, inventory, new ShiftServiceImpl(repository),
                Clock.fixed(Instant.parse("2026-10-27T00:00:00Z"), ZoneOffset.UTC),
                org.mapstruct.factory.Mappers.getMapper(com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper.class),
                new com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport(security),
                mock(com.kitolam.rentalroommanagement.modules.notification.service.NotificationService.class));
    }

    @Test
    void partialSuccessPreservesOtherPeriodsEnableStateAndNoOpVersion() {
        stored.get(R1).setPeriods(List.of(new Shift.Period("730000000000000000000001", ShiftType.MORNING, "08:00", "10:00", false),
                stored.get(R1).getPeriods().get(1), stored.get(R1).getPeriods().get(2)));
        stored.get(R2).setPeriods(List.of(stored.get(R2).getPeriods().getFirst(),
                new Shift.Period("730000000000000000000002", ShiftType.AFTERNOON, "10:30", "12:00", true), stored.get(R2).getPeriods().get(2)));
        stored.get(R3).setPeriods(List.of(new Shift.Period("730000000000000000000001", ShiftType.MORNING, "09:00", "11:00", true),
                stored.get(R3).getPeriods().get(1), stored.get(R3).getPeriods().get(2)));
        var oldOtherPeriods = stored.get(R1).getPeriods().subList(1, 3);
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1), target(R2), target(R3)));
        assertEquals(1, result.updated()); assertEquals(1, result.unchanged()); assertEquals(1, result.failed());
        assertEquals(List.of(Status.UPDATED, Status.FAILED, Status.UNCHANGED), result.results().stream().map(r -> r.status()).toList());
        assertFalse(stored.get(R1).getPeriods().getFirst().isActive());
        assertEquals(oldOtherPeriods, stored.get(R1).getPeriods().subList(1, 3));
        assertEquals(1L, stored.get(R1).getVersion());
        assertEquals(0L, stored.get(R2).getVersion()); assertEquals(0L, stored.get(R3).getVersion());
        verify(repository, times(1)).save(any());
    }

    @Test
    void staleVersionFailsOnlyThatRoomWithoutRebasingOrRetry() {
        var result = service.updateBranchShifts(BRANCH, request("09:00", "10:00", new RoomVersion(R1, 99L), target(R2)));
        assertEquals("SHIFT_VERSION_CONFLICT", result.results().getFirst().code());
        assertEquals(1, result.updated());
        assertEquals("08:00", stored.get(R1).getPeriods().getFirst().startTime());
    }

    @Test
    void databaseCompareAndSetConflictDoesNotPreventFollowingRooms() {
        doThrow(new OptimisticLockingFailureException("concurrent edit"))
                .when(repository).save(argThat(value -> value != null && R1.equals(value.getRoomId())));
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1), target(R2)));
        assertEquals("SHIFT_VERSION_CONFLICT", result.results().getFirst().code());
        assertEquals(1, result.failed()); assertEquals(1, result.updated());
        verify(repository, times(2)).save(any());
    }

    @Test
    void roomOutsideRequestedBranchIsRejectedEvenIfOwnerOwnsBothBranches() {
        signIn(true, Set.of(BRANCH, OTHER_BRANCH));
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R4), target(R1)));
        assertEquals("ROOM_OUTSIDE_BRANCH", result.results().getFirst().code());
        assertNull(result.results().getFirst().roomNumber());
        verify(repository, never()).findByIdAndIsDeletedFalse(R4);
        assertEquals(1, result.updated());
    }

    @Test
    void unknownRoomProducesAnIndividualFailure() {
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00",
                target("710000000000000000000099"), target(R1)));
        assertEquals("ROOM_NOT_FOUND", result.results().getFirst().code());
        assertEquals(1, result.updated());
    }

    @Test
    void branchAuthorizationPrecedesInventoryReadsAndWrites() {
        assertThrows(ForbiddenException.class, () -> service.updateBranchShifts(OTHER_BRANCH, request("09:00", "11:00", target(R1))));
        assertThrows(ForbiddenException.class, () -> service.branchShiftConfigurations(OTHER_BRANCH, 1, 20));
        when(security.currentAccount()).thenReturn(Optional.empty());
        assertThrows(UnauthorizedException.class, () -> service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1))));
        signIn(false, Set.of(BRANCH));
        assertThrows(ForbiddenException.class, () -> service.branchShiftConfigurations(BRANCH, 1, 20));
        verifyNoInteractions(repository, inventory);
    }

    @Test
    void malformedWholePayloadIsRejectedBeforeAnyWrites() {
        assertThrows(BadRequestException.class, () -> service.updateBranchShifts(BRANCH, request("22:00", "02:00", target(R1))));
        assertThrows(BadRequestException.class, () -> service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1), target(R1))));
        assertThrows(BadRequestException.class, () -> service.updateBranchShifts(BRANCH, new ShiftBulkUpdateRequest(
                ShiftType.MORNING, "09:00", "11:00", Collections.nCopies(101, target(R1)))));
        assertThrows(BadRequestException.class, () -> service.updateBranchShifts(BRANCH, request("09:00", "11:00", new RoomVersion(R1, null))));
        verifyNoInteractions(repository, inventory);
    }

    @Test
    void unchangedRoomDoesNotWriteOrLoadAffectedAppointments() {
        var result = service.updateBranchShifts(BRANCH, request("08:00", "10:00", target(R1)));
        assertEquals(1, result.unchanged());
        verify(repository, never()).save(any()); verifyNoInteractions(appointments);
    }

    @Test
    void appointmentsAreReportedWithoutChangingTheirHoursStatusOrHold() {
        Appointment a = new Appointment(); a.setId("appointment"); a.setRoomId(R1);
        a.setAppointmentDate(LocalDate.of(2026, 10, 28)); a.setShiftType(ShiftType.MORNING);
        a.setShiftId(stored.get(R1).getPeriods().getFirst().id()); a.setStatus(AppointmentStatus.CONFIRMED);
        a.setStartAt(Instant.parse("2026-10-28T01:00:00Z")); a.setEndAt(Instant.parse("2026-10-28T03:00:00Z"));
        when(appointments.findByRoomIdAndAppointmentDateGreaterThanEqualAndIsDeletedFalse(eq(R1), any())).thenReturn(List.of(a));
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1)));
        assertEquals(1, result.results().getFirst().affectedAppointments().size());
        assertEquals(Instant.parse("2026-10-28T01:00:00Z"), a.getStartAt());
        assertEquals(AppointmentStatus.CONFIRMED, a.getStatus()); verify(appointments, never()).save(any());
    }

    @Test
    void warningReadFailureAfterSaveStillReportsUpdatedAndContinues() {
        when(appointments.findByRoomIdAndAppointmentDateGreaterThanEqualAndIsDeletedFalse(eq(R1), any()))
                .thenThrow(new DataAccessResourceFailureException("test read failure"));
        var result = service.updateBranchShifts(BRANCH, request("09:00", "11:00", target(R1), target(R2)));
        assertEquals(2, result.updated()); assertEquals(0, result.failed());
        assertEquals("APPOINTMENT_WARNING_UNAVAILABLE", result.results().getFirst().code());
        assertEquals(1L, stored.get(R1).getVersion());
    }

    @Test
    void branchListingIsPaginatedAndLegacyRoomDoesNotHideValidPeers() {
        var second = service.branchShiftConfigurations(BRANCH, 2, 1);
        assertEquals(2, second.getNumber()); assertEquals(3, second.getTotalElements());
        assertEquals(R2, second.getContent().getFirst().roomId());
        stored.get(R2).setPeriods(null);
        var all = service.branchShiftConfigurations(BRANCH, 1, 20);
        assertEquals(3, all.getContent().size());
        assertNull(all.getContent().get(1).version()); assertNotNull(all.getContent().get(1).errorCode());
        assertNotNull(all.getContent().getFirst().version());
    }

    private void signIn(boolean active, Set<String> branches) {
        when(security.currentAccount()).thenReturn(Optional.of(new Actor(new AuthPrincipal("owner", "account@example.test", null, Role.OWNER.name(), active, "Owner", null), null, branches)));
    }

    private ViewingRoomSnapshot room(String id, String branch) {
        return new ViewingRoomSnapshot(id, branch, "Phòng " + id.substring(22), "Branch", null,
                true, true, true, ViewingRoomSnapshot.RentalMode.ROOM, 1, 0, 0, 0, List.of(), "1", Instant.now());
    }

    private Shift schedule(String id) {
        Shift s = new Shift(); s.setId(id); s.setRoomId(id); s.setVersion(0L);
        s.setPeriods(List.of(new Shift.Period("730000000000000000000001", ShiftType.MORNING, "08:00", "10:00", true),
                new Shift.Period("730000000000000000000002", ShiftType.AFTERNOON, "14:00", "16:00", true),
                new Shift.Period("730000000000000000000003", ShiftType.EVENING, "18:00", "20:00", true)));
        return s;
    }

    private Shift copy(Shift source) {
        if (source == null) return null;
        Shift result = new Shift(); result.setId(source.getId()); result.setRoomId(source.getRoomId());
        result.setVersion(source.getVersion()); result.setPeriods(source.getPeriods() == null ? null : List.copyOf(source.getPeriods()));
        return result;
    }

    private RoomVersion target(String id) { return new RoomVersion(id, 0L); }
    private ShiftBulkUpdateRequest request(String start, String end, RoomVersion... rooms) {
        return new ShiftBulkUpdateRequest(ShiftType.MORNING, start, end, List.of(rooms));
    }
}
