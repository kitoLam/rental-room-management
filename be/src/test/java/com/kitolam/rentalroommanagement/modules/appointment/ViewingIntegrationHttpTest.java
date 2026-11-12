package com.kitolam.rentalroommanagement.modules.appointment;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.appointment.integration.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AccountIdentityResponse;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.EffectiveRoomHoldResponse;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ViewingIntegrationHttpTest {
    final AuthService users = mock(AuthService.class);
    final BranchService branches = mock(BranchService.class);
    final ManagerService managers = mock(ManagerService.class);
    final TenantService tenants = mock(TenantService.class);
    final AppointmentAccessService access = new AppointmentAccessService(users, branches, managers, tenants);
    @AfterEach void clear(){ SecurityContextHolder.clearContext(); }
    void login(String id,String role) {
        var p = AuthPrincipal.from(new AccountIdentityResponse(id, "account@example.test", "Test", "0901234567", role, true));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities()));
    }
    @Test void noAuthenticatedPrincipalMeansNoIdentity() { assertTrue(access.currentAccount().isEmpty()); }
    @Test void anonymousAndUnauthenticatedPrincipalsAreRejected() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        assertTrue(access.currentAccount().isEmpty());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthPrincipal("user", "account@example.test", "OWNER"), null));
        assertTrue(access.currentAccount().isEmpty());
    }

    @Test void managementRecipientsUseDatabaseAssignmentsWithoutAnHttpSession() {
        when(users.activeManagementAccounts()).thenReturn(List.of(
                new AccountIdentityResponse("owner", "owner@example.test", "Owner", null, "OWNER", true),
                new AccountIdentityResponse("outsider", "outsider@example.test", "Other owner", null, "OWNER", true),
                new AccountIdentityResponse("inactive", "inactive@example.test", "Inactive", null, "OWNER", false)));
        when(branches.ownedBranchIds("owner")).thenReturn(Set.of("branch"));
        when(branches.ownedBranchIds("outsider")).thenReturn(Set.of("other"));
        assertEquals(List.of("owner"), access.managementAccounts("branch").stream().map(account -> account.accountId()).toList());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(users, never()).findAccount(anyString());
    }
    @Test void identityUsesAuthenticatedPrincipalWithoutReloadingAccountAndMapsTenantProfile() {
        login("account","TENANT");
        when(tenants.profileIdByEmail("account@example.test")).thenReturn(Optional.of("profile"));
        var account = access.currentAccount().orElseThrow();
        assertEquals("account", account.accountId());
        assertEquals("profile", account.tenantProfileId());
        assertEquals("Test", account.fullName());
        assertEquals("0901234567", account.phone());
        assertTrue(account.canRequest());
        verifyNoInteractions(users);
    }
    @Test void ownerOnlyGetsBranchesOwnedByThatAccount() {
        login("owner","OWNER");
        when(branches.ownedBranchIds("owner")).thenReturn(Set.of("branch-one"));
        var actor = access.currentAccount().orElseThrow();
        assertTrue(actor.canManage("branch-one"));
        assertFalse(actor.canManage("branch-two"));
        assertFalse(actor.canManage(null));
        assertThrows(UnsupportedOperationException.class, () -> actor.manageableBranchIds().add("other"));
    }
    @Test void disabledPrincipalHasNoViewingRights() {
        var principal = new AuthPrincipal("user", "account@example.test", null, "TENANT", false);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        assertFalse(access.currentAccount().orElseThrow().canRequest());
        verifyNoInteractions(users, branches, managers, tenants);
    }
    @Test void tenantCanRequestBeforeHavingATenantProfileAndCannotManageBranches() {
        login("user", "TENANT");
        var actor = access.currentAccount().orElseThrow();
        assertTrue(actor.canRequest());
        assertNull(actor.tenantProfileId());
        assertFalse(actor.canManage("branch-one"));
    }

    @Test void managerRequiresActiveAssignmentAndExplicitViewingPermission() {
        login("manager", "MANAGER");
        var assignment = mock(ManagerResponse.class);
        when(managers.findAssignment("account@example.test")).thenReturn(Optional.of(assignment));
        when(assignment.branchId()).thenReturn("assigned");
        when(assignment.status()).thenReturn(ManagerStatus.ACTIVE);
        when(assignment.permissions()).thenReturn(List.of());
        assertFalse(access.currentAccount().orElseThrow().canManage("assigned"));
        when(assignment.permissions()).thenReturn(List.of(ManagerService.VIEWING_PERMISSION));
        assertTrue(access.currentAccount().orElseThrow().canManage("assigned"));
        assertFalse(access.currentAccount().orElseThrow().canManage("other"));
        when(assignment.status()).thenReturn(ManagerStatus.INACTIVE);
        assertFalse(access.currentAccount().orElseThrow().canManage("assigned"));
    }

    @Test void realInventoryDistinguishesTemporaryAndOfficialHoldsWithoutDoubleCounting() {
        var rooms = mock(RoomService.class);
        var bookings = mock(BookingService.class);
        var room = mock(RoomResponse.class);
        var branch = mock(BranchResponse.class);
        when(rooms.getById("room")).thenReturn(room);
        when(room.id()).thenReturn("room");
        when(room.branchId()).thenReturn("branch");
        when(room.status()).thenReturn(RoomStatus.AVAILABLE);
        when(branches.getById("branch")).thenReturn(branch);
        when(branch.id()).thenReturn("branch");
        when(branch.status()).thenReturn(BranchStatus.ACTIVE);
        var slots = mock(com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService.class);
        var free = new com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService.OverviewSlot("slot", "room", "S01", com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.AVAILABLE, null);
        when(slots.readForOverview(List.of("room"))).thenReturn(List.of(free));
        var inventory = new DatabaseViewingInventoryGateway(rooms, branches, bookings, java.time.Clock.systemUTC(), slots,
                mock(com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService.class),
                mock(com.kitolam.rentalroommanagement.modules.contract.service.ContractService.class));
        var deadline = java.time.Instant.now().plusSeconds(3600);
        when(bookings.readForOverview(List.of("slot"))).thenReturn(List.of(new BookingService.OverviewBooking("booking", "tenant", "slot", List.of("slot"), null, null, deadline, deadline, null,
                com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.AWAITING_PAYMENT)));
        assertEquals(1, inventory.getRoom("room").temporarilyHeldUnits());
        assertEquals(0, inventory.getRoom("room").officiallyHeldUnits());
        when(bookings.readForOverview(List.of("slot"))).thenReturn(List.of(new BookingService.OverviewBooking("booking", "tenant", "slot", List.of("slot"), null, null, deadline, deadline, null,
                com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus.CONFIRMED)));
        assertEquals(0, inventory.getRoom("room").temporarilyHeldUnits());
        assertEquals(1, inventory.getRoom("room").officiallyHeldUnits());
        when(room.status()).thenReturn(RoomStatus.OCCUPIED);
        when(slots.readForOverview(List.of("room"))).thenReturn(List.of(new com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService.OverviewSlot("slot", "room", "S01", com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus.OCCUPIED, null)));
        assertEquals(1, inventory.getRoom("room").occupiedUnits());
        assertEquals(0, inventory.getRoom("room").officiallyHeldUnits());
    }
}
