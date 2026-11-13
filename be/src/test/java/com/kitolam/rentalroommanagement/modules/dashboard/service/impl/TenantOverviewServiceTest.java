package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.service.SlotServiceRequestService;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantOverviewServiceTest {
    private static final AuthPrincipal TENANT = new AuthPrincipal("account", "tenant@test.local", "TENANT");
    private static final Instant NOW = Instant.parse("2026-11-15T03:00:00Z");
    @Mock TenantService tenants;
    @Mock ContractService contracts;
    @Mock ContractTenantService tenancies;
    @Mock RoomService rooms;
    @Mock RoomSlotService slots;
    @Mock BranchService branches;
    @Mock InvoiceService invoices;
    @Mock PaymentService payments;
    @Mock ReportRequestService support;
    @Mock SlotServiceRequestService serviceRequests;
    @Mock ContractRepository contractRepository;
    @Mock NotificationService notifications;
    TenantOverviewServiceImpl service;

    @BeforeEach void setup() {
        service = new TenantOverviewServiceImpl(tenants, contracts, tenancies, rooms, slots, branches, invoices,
                payments, support, serviceRequests, contractRepository, notifications, Clock.fixed(NOW, ZoneOffset.UTC));
    }
    void scope(boolean representative, List<String> assigned, LocalDate joinedAt) {
        when(tenants.profileIdByEmail(TENANT.email())).thenReturn(Optional.of("profile"));
        when(tenancies.readOwnedForOverview("profile")).thenReturn(List.of(new ContractTenantService.TenantLease("lease", "contract",
                assigned, representative, new BigDecimal("1500000"), joinedAt, null, ContractTenantStatus.ACTIVE)));
        var contract = mock(ContractResponse.class);
        when(contract.id()).thenReturn("contract"); when(contract.roomId()).thenReturn("room");
        when(contract.status()).thenReturn(ContractStatus.ACTIVE);
        when(contract.startDate()).thenReturn(LocalDate.of(2026, 11, 1));
        when(contract.endDate()).thenReturn(LocalDate.of(2026, 12, 15));
        lenient().when(contract.roomSlotIds()).thenReturn(List.of("own-slot", "other-slot"));
        when(contracts.search(any(), any(Pageable.class), eq(TENANT))).thenReturn(PagedResponse.of(List.of(contract), 1, 100, 1));
        var room = mock(RoomResponse.class); when(room.id()).thenReturn("room"); when(room.branchId()).thenReturn("branch");
        when(rooms.getById("room")).thenReturn(room);
        var branch = mock(BranchResponse.class); when(branch.id()).thenReturn("branch");
        when(branches.getById("branch")).thenReturn(branch);
        when(slots.readForOverview(List.of("room"))).thenReturn(List.of(
                new RoomSlotService.OverviewSlot("own-slot", "room", "S01", RoomSlotStatus.OCCUPIED, null),
                new RoomSlotService.OverviewSlot("other-slot", "room", "S02", RoomSlotStatus.OCCUPIED, null)));
    }
    void inbox() {
        when(notifications.list(any(), isNull(), any())).thenReturn(PagedResponse.of(List.of(), 1, 3, 0));
    }

    @Test void rejectsManagementRoleBeforeReadingAnything() {
        assertThrows(ForbiddenException.class, () -> service.overview(new AuthPrincipal("manager", "m@test.local", "MANAGER"), null));
        verifyNoInteractions(tenants, contracts, invoices, notifications);
    }
    @Test void accountWithoutLeaseStillGetsAnOverviewAndNoFinancialReads() {
        when(tenants.profileIdByEmail(TENANT.email())).thenReturn(Optional.empty()); inbox();
        var result = service.overview(TENANT, null);
        assertNull(result.tenancy()); assertNull(result.unpaidInvoiceCount());
        verifyNoInteractions(invoices, payments, support, contractRepository);
    }
    @Test void rejectsForeignTenancyBeforeReadingMoneyOrNotifications() {
        scope(false, List.of("own-slot"), LocalDate.of(2026, 11, 1));
        assertThrows(ForbiddenException.class, () -> service.overview(TENANT, "foreign-lease"));
        verifyNoInteractions(invoices, payments, support, notifications);
    }
    @Test void memberSeesOnlyAssignedSlotsAndTheirOwnRent() {
        scope(false, List.of("own-slot"), LocalDate.of(2026, 11, 1));
        var result = service.tenancies(TENANT).getFirst();
        assertEquals("lease", result.id()); assertEquals("contract", result.contractId());
        assertEquals(List.of("own-slot"), result.roomSlotIds());
        assertEquals(List.of("S01"), result.slotCodes());
        assertEquals(new BigDecimal("1500000"), result.rentAmount());
        assertEquals("branch", result.branchId());
    }
    @Test void memberWithoutAssignedSlotsDoesNotInheritRoommatesSlots() {
        scope(false, List.of(), LocalDate.of(2026, 11, 1));
        assertTrue(service.tenancies(TENANT).getFirst().roomSlotIds().isEmpty());
    }
    @Test void futureJoinDateIsNotAnActiveTenancy() {
        scope(false, List.of("own-slot"), LocalDate.of(2026, 11, 20));
        assertEquals("DRAFT", service.tenancies(TENANT).getFirst().status());
    }
    @Test void scopesBalancesAndSupportToOwnedTenancyAndSupportsOldContractLinks() {
        scope(false, List.of("own-slot"), LocalDate.of(2026, 11, 1)); inbox();
        when(invoices.readForTenantOverview(List.of("contract"))).thenReturn(List.of(
                new InvoiceService.TenantInvoice("i1", "HD01", "2026-11", LocalDate.of(2026, 11, 14), new BigDecimal("200"), new BigDecimal("100"), InvoiceStatus.PARTIALLY_PAID),
                new InvoiceService.TenantInvoice("i2", "HD02", "2026-11", LocalDate.of(2026, 11, 18), new BigDecimal("300"), BigDecimal.ZERO, InvoiceStatus.PAID)));
        when(support.readForTenantOverview(anyList(), eq("contract"))).thenReturn(List.of(
                new ReportRequestService.TenantSupport("s1", "Bổ sung", ReportRequestStatus.WAITING_INFO, NOW),
                new ReportRequestService.TenantSupport("s2", "Đã xử lý", ReportRequestStatus.RESOLVED, NOW),
                new ReportRequestService.TenantSupport("s3", "Đã đóng", ReportRequestStatus.CLOSED, NOW)));
        var result = service.overview(TENANT, "contract");
        assertEquals("lease", result.tenancy().id());
        assertEquals(1L, result.unpaidInvoiceCount()); assertEquals(new BigDecimal("100"), result.nextDueAmount());
        assertEquals(LocalDate.of(2026, 11, 14), result.nextDueDate());
        assertEquals(2, result.needsResponseCount()); assertEquals(2, result.openSupportCount());
        verify(contractRepository).findByIdAndIsDeletedFalse("contract");
        verify(serviceRequests).statusesForContract("contract");
    }
    @Test void missingBalanceIsUnknownRatherThanZeroDebt() {
        scope(false, List.of("own-slot"), LocalDate.of(2026, 11, 1)); inbox();
        when(invoices.readForTenantOverview(List.of("contract"))).thenReturn(List.of(new InvoiceService.TenantInvoice(
                "i", "HD", "2026-11", null, new BigDecimal("500"), null, InvoiceStatus.ISSUED)));
        var result = service.overview(TENANT, "lease");
        assertTrue(result.incompleteBalances()); assertNull(result.unpaidInvoiceCount()); assertNull(result.nextDueAmount());
    }
}
