package com.kitolam.rentalroommanagement.modules.appointment;

import com.kitolam.rentalroommanagement.common.exception.exceptions.*;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest.PeriodInput;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.impl.ShiftServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ViewingShiftConfigurationTest {
    private static final String ROOM = "710000000000000000000001";
    private ShiftRepository repository;
    private ShiftServiceImpl service;
    private Shift current;

    @BeforeEach
    void setup() {
        repository = mock(ShiftRepository.class);
        service = new ShiftServiceImpl(repository);
        current = new Shift(); current.setId(ROOM); current.setRoomId(ROOM); current.setVersion(0L);
        current.setPeriods(List.of(new Shift.Period("730000000000000000000001", ShiftType.MORNING, "08:00", "10:00", true),
                new Shift.Period("730000000000000000000002", ShiftType.AFTERNOON, "14:00", "16:00", true),
                new Shift.Period("730000000000000000000003", ShiftType.EVENING, "18:00", "20:00", true)));
        when(repository.findByIdAndIsDeletedFalse(ROOM)).thenReturn(Optional.of(current));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void missingConfigurationInitializesExactlyThreeDefaultsWithStableDatabaseIds() {
        when(repository.findByIdAndIsDeletedFalse(ROOM)).thenReturn(Optional.empty());
        when(repository.insert(any(Shift.class))).thenAnswer(call -> call.getArgument(0));
        var created = service.getForRoom(ROOM);
        assertEquals(ROOM, created.getId());
        assertEquals(List.of("08:00", "14:00", "18:00"), created.getPeriods().stream().map(Shift.Period::startTime).toList());
        assertEquals(3, created.getPeriods().stream().map(Shift.Period::id).distinct().count());
    }

    @Test
    void rejectsDuplicateTypesMissingTypesAndFourthPeriod() {
        var inputs = inputs();
        inputs.set(1, inputs.getFirst());
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs)));
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, List.of())));
        var four = inputs(); four.add(four.getFirst());
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, four)));
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsOverlapsEvenForDisabledPeriodsAndRejectsOvernightOrEqualHours() {
        var inputs = inputs(); inputs.set(0, new PeriodInput(ShiftType.MORNING, "08:00", "15:00", false));
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs)));
        inputs.set(0, new PeriodInput(ShiftType.MORNING, "22:00", "02:00", true));
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs)));
        inputs.set(0, new PeriodInput(ShiftType.MORNING, "10:00", "10:00", true));
        assertThrows(BadRequestException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs)));
    }

    @Test
    void adjacentPeriodsAreAllowedAndUpdatesPreservePeriodIds() {
        var inputs = inputs(); inputs.set(0, new PeriodInput(ShiftType.MORNING, "08:00", "14:00", false));
        var ids = current.getPeriods().stream().map(Shift.Period::id).toList();
        var result = service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs));
        assertEquals(ids, result.getPeriods().stream().map(Shift.Period::id).toList());
        assertFalse(result.getPeriods().getFirst().isActive());
    }

    @Test
    void staleClientAndConcurrentDatabaseWriteBothProduceConflict() {
        assertThrows(ConflictException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(5L, inputs())));
        verify(repository, never()).save(any());
        when(repository.save(any())).thenThrow(new OptimisticLockingFailureException("concurrent write"));
        assertThrows(ConflictException.class, () -> service.updateForRoom(ROOM, new ShiftUpdateRequest(0L, inputs())));
    }

    @Test
    void legacyConfigurationIsNotSilentlyReinterpretedOrOverwritten() {
        current.setPeriods(null);
        assertThrows(ConflictException.class, () -> service.getForRoom(ROOM));
        verify(repository, never()).insert(any(Shift.class));
        verify(repository, never()).save(any());
    }

    private ArrayList<PeriodInput> inputs() {
        return new ArrayList<>(List.of(new PeriodInput(ShiftType.MORNING, "08:00", "10:00", true),
                new PeriodInput(ShiftType.AFTERNOON, "14:00", "16:00", true),
                new PeriodInput(ShiftType.EVENING, "18:00", "20:00", true)));
    }
}
