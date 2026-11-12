package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminAccountStatistics;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.AdminBranchStatistics;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminOverviewServiceTest {
    final AuthService accounts = mock(AuthService.class);
    final BranchService branches = mock(BranchService.class);
    final RoomService rooms = mock(RoomService.class);
    final RoomSlotService slots = mock(RoomSlotService.class);
    final AuthPrincipal admin = new AuthPrincipal("admin", "admin@test.local", "ADMIN");
    final Instant now = Instant.parse("2026-12-31T17:15:00Z");
    final AdminOverviewServiceImpl service = new AdminOverviewServiceImpl(accounts, branches, rooms, slots,
            Clock.fixed(now, ZoneOffset.UTC));

    @Test
    void deniesOtherRolesBeforeReadingAnyData() {
        for (String role : List.of("TENANT", "OWNER", "MANAGER"))
            assertThrows(ForbiddenException.class, () -> service.overview(new AuthPrincipal("user", "test@test.local", role), 2026));
        assertThrows(ForbiddenException.class, () -> service.overview(null, 2026));
        assertThrows(ForbiddenException.class, () -> service.overview(new AuthPrincipal("admin", "test@test.local", null, "ADMIN", false), 2026));
        verifyNoInteractions(accounts, branches, rooms, slots);
    }

    @Test
    void rejectsInvalidYearsBeforeReadingData() {
        assertThrows(BadRequestException.class, () -> service.overview(admin, 1899));
        assertThrows(BadRequestException.class, () -> service.overview(admin, 9999));
        verifyNoInteractions(accounts, branches, rooms, slots);
    }

    @Test
    void fillsEmptyMonthsAndUsesVietnamYearWithoutChangingAnything() {
        when(accounts.readStatisticsForAdmin(2027)).thenReturn(new AdminAccountStatistics(0, 0, 0, 0, List.of(), List.of(), List.of()));
        when(branches.readStatisticsForAdmin()).thenReturn(new AdminBranchStatistics(List.of(), List.of()));
        when(rooms.readStatusTotalsForAdmin()).thenReturn(List.of());
        when(slots.readStatusTotalsForAdmin()).thenReturn(List.of());
        var result = service.overview(admin, null);
        assertEquals(2027, result.year());
        assertEquals(LocalDate.of(2027, 1, 1), result.today());
        assertEquals(12, result.registrations().size());
        assertTrue(result.registrations().stream().allMatch(m -> m.count() == 0));
        assertEquals(4, result.roles().size());
        assertEquals(0, result.metrics().totalAccounts());
        verify(accounts).readStatisticsForAdmin(2027);
        verify(branches).readStatisticsForAdmin();
        verify(rooms).readStatusTotalsForAdmin();
        verify(slots).readStatusTotalsForAdmin();
        verifyNoMoreInteractions(accounts, branches, rooms, slots);
    }

    @Test
    void keepsCurrentTotalsSeparateFromRegistrationYear() {
        when(accounts.readStatisticsForAdmin(2025)).thenReturn(new AdminAccountStatistics(9, 5, 3, 1,
                List.of(new AdminAccountStatistics.RoleCount("TENANT", 8), new AdminAccountStatistics.RoleCount("ADMIN", 1)),
                List.of(new AdminAccountStatistics.MonthCount(4, 2)), List.of()));
        when(branches.readStatisticsForAdmin()).thenReturn(new AdminBranchStatistics(List.of(
                new AdminBranchStatistics.StatusTotal("ACTIVE", 2), new AdminBranchStatistics.StatusTotal("INACTIVE", 1)), List.of()));
        when(rooms.readStatusTotalsForAdmin()).thenReturn(List.of(new RoomService.StatusTotal("OCCUPIED", 7)));
        when(slots.readStatusTotalsForAdmin()).thenReturn(List.of(new RoomSlotService.StatusTotal("OCCUPIED", 20)));
        var result = service.overview(admin, 2025);
        assertEquals(9, result.metrics().totalAccounts());
        assertEquals(5, result.metrics().activeAccounts());
        assertEquals(3, result.metrics().totalBranches());
        assertEquals(2, result.metrics().activeBranches());
        assertEquals(7, result.metrics().totalRooms());
        assertEquals(20, result.metrics().totalSlots());
        assertEquals(2, result.registrations().get(3).count());
        assertEquals(0, result.registrations().get(4).count());
        assertEquals(0, result.roles().stream().filter(r -> r.role().equals("OWNER")).findFirst().orElseThrow().count());
    }
}
