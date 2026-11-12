package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import com.kitolam.rentalroommanagement.modules.reportrecord.service.ReportRecordService;
import com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.ServiceRequestService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
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
class DashboardServiceTest {
    private static final String BRANCH = "710000000000000000000001";
    private static final String ROOM = "710000000000000000000002";
    private static final String SLOT = "710000000000000000000003";
    private static final AuthPrincipal OWNER = new AuthPrincipal("owner", "owner@test.local", "OWNER");
    private static final Instant NOW = Instant.parse("2026-11-15T03:00:00Z");
    @Mock BranchService branches;
    @Mock RoomService rooms;
    @Mock RoomSlotService slots;
    @Mock RoomSlotOccupancyService occupancies;
    @Mock ContractService contracts;
    @Mock ContractTenantService tenancies;
    @Mock BookingService bookings;
    @Mock AppointmentService appointments;
    @Mock ServiceRequestService serviceRequests;
    @Mock ReportRequestService reports;
    @Mock TenantService tenants;
    @Mock ManagerService managers;
    @Mock InvoiceService invoices;
    @Mock PaymentService payments;
    DashboardServiceImpl service;
    @Mock ReportRecordService reportRecords;

    @BeforeEach void setup() {
        service = new DashboardServiceImpl(branches, rooms, slots, occupancies, contracts, tenancies, bookings,
                appointments, serviceRequests, reports, reportRecords, tenants, managers, invoices, payments, Clock.fixed(NOW, ZoneOffset.UTC));
    }
    void scope() {
        when(branches.managedBranches(OWNER)).thenReturn(List.of(new BranchResponse(BRANCH, "Cơ sở 1", "123 Điện Biên Phủ",
                null, null, null, BranchStatus.ACTIVE, null, null, "owner", null, null, null)));
        RoomResponse room = mock(RoomResponse.class);
        when(room.id()).thenReturn(ROOM);
        when(room.branchId()).thenReturn(BRANCH);
        lenient().when(room.status()).thenReturn(RoomStatus.AVAILABLE);
        lenient().when(room.roomNumber()).thenReturn("P.101");
        when(rooms.listByBranch(eq(BRANCH), any(Pageable.class))).thenReturn(PagedResponse.of(List.of(room), 1, 100, 1));
    }

    @Test void rejectsTenantBeforeReadingAnyData() {
        assertThrows(ForbiddenException.class, () -> service.management(new AuthPrincipal("tenant", "tenant@test.local", "TENANT"), null, null, 0));
        verifyNoInteractions(branches, rooms, slots, contracts, invoices, payments);
    }
    @Test void rejectsForeignBranchBeforeReadingRooms() {
        when(branches.managedBranches(OWNER)).thenReturn(List.of());
        assertThrows(ForbiddenException.class, () -> service.management(OWNER, BRANCH, null, 0));
        verifyNoInteractions(rooms, slots, contracts, tenants, invoices, payments);
    }
    @Test void countsDistinctSlotsAndPeopleAndScopesMoneyToVietnamCalendarMonth() {
        scope();
        when(slots.readForOverview(anyList())).thenReturn(List.of(
                new RoomSlotService.OverviewSlot(SLOT, ROOM, "S01", RoomSlotStatus.AVAILABLE, null),
                new RoomSlotService.OverviewSlot("second", ROOM, "S02", RoomSlotStatus.MAINTENANCE, null)));
        when(occupancies.readForOverview(anyList())).thenReturn(List.of(
                new RoomSlotOccupancyService.OverviewOccupancy(SLOT, "ct1", null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 15), OccupancyStatus.ACTIVE),
                new RoomSlotOccupancyService.OverviewOccupancy(SLOT, "ct2", null, null, null, OccupancyStatus.ACTIVE)));
        when(contracts.readForOverview(anyList())).thenReturn(List.of(activeContract("c1", "tenant", LocalDate.of(2026, 12, 15))));
        when(tenancies.readForOverview(anyList())).thenReturn(List.of(
                new ContractTenantService.OverviewTenancy("ct1", "c1", "tenant", ContractTenantStatus.ACTIVE, null, null),
                new ContractTenantService.OverviewTenancy("ct2", "c1", "tenant", ContractTenantStatus.ACTIVE, null, null)));
        when(invoices.readForOverview(anyList())).thenReturn(List.of(new InvoiceService.OverviewInvoice("invoice", "ct1")));
        when(payments.readForOverview(anyList(), any(), any())).thenReturn(List.of(new PaymentService.OverviewPayment("invoice", new BigDecimal("2500000"))));
        var result = service.management(OWNER, BRANCH, YearMonth.of(2026, 11), 0);
        assertEquals(1, result.metrics().occupiedSlots());
        assertEquals(1, result.metrics().activeTenants());
        assertEquals(1, result.slots().operational());
        assertEquals(1, result.slots().maintenance());
        assertEquals(new BigDecimal("2500000"), result.metrics().receipts());
        assertEquals(1, result.expiringContracts().getTotalElements());
        verify(payments).readForOverview(eq(List.of("invoice")), eq(Instant.parse("2026-10-31T17:00:00Z")), eq(Instant.parse("2026-11-30T17:00:00Z")));
    }
    @Test void pendingWorkExcludesStepsWaitingOnTenantOrAdmin() {
        scope();
        when(slots.readForOverview(anyList())).thenReturn(List.of(new RoomSlotService.OverviewSlot(SLOT, ROOM, "S01", RoomSlotStatus.AVAILABLE, null)));
        when(bookings.readForOverview(anyList())).thenReturn(List.of(
                new BookingService.OverviewBooking("b1", "tenant", SLOT, List.of(SLOT), null, null, NOW.plusSeconds(300), NOW.plusSeconds(200), null, BookingStatus.AWAITING_PAYMENT),
                new BookingService.OverviewBooking("b2", "tenant", SLOT, List.of(SLOT), null, null, null, null, null, BookingStatus.REQUESTED)));
        when(appointments.readForOverview(anyList())).thenReturn(List.of(
                new AppointmentService.OverviewAppointment("a1", ROOM, LocalDate.of(2026, 11, 15), NOW, NOW.plusSeconds(7200),
                        com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType.MORNING,
                        AppointmentStatus.PENDING, null, null, null, null, null)));
        when(serviceRequests.readForOverview(anyList())).thenReturn(List.of(
                new ServiceRequestService.OverviewServiceRequest(ROOM, ServiceRequestStatus.APPROVED)));
        when(reports.readForOverview(anyList())).thenReturn(List.of(
                new ReportRequestService.OverviewReport(ROOM, ReportRequestStatus.PENDING),
                new ReportRequestService.OverviewReport(ROOM, ReportRequestStatus.WAITING_INFO),
                new ReportRequestService.OverviewReport(ROOM, ReportRequestStatus.RESOLVED)));
        var result = service.management(OWNER, BRANCH, null, 0);
        assertEquals(1, result.slots().held());
        assertEquals(1, result.pending().stream().filter(w -> w.key().equals("bookings")).findFirst().orElseThrow().count());
        assertEquals(1, result.pending().stream().filter(w -> w.key().equals("support")).findFirst().orElseThrow().count());
        assertEquals(1, result.pending().stream().filter(w -> w.key().equals("services")).findFirst().orElseThrow().count());
        assertTrue(result.todaysAppointments().isEmpty());
    }
    @Test void showsApprovalsMadeTodayEvenWhenViewingDateIsTomorrow() {
        scope();
        Instant tomorrow = NOW.plusSeconds(86400);
        Instant dayStart = Instant.parse("2026-11-14T17:00:00Z");
        when(appointments.readForOverview(anyList())).thenReturn(List.of(
                overviewAppointment("today", AppointmentStatus.CONFIRMED, dayStart, tomorrow),
                overviewAppointment("yesterday", AppointmentStatus.CONFIRMED, dayStart.minusSeconds(1), NOW),
                overviewAppointment("next-day", AppointmentStatus.CONFIRMED, dayStart.plusSeconds(86400), tomorrow),
                overviewAppointment("cancelled", AppointmentStatus.CANCELLED, NOW, tomorrow),
                overviewAppointment("pending", AppointmentStatus.PENDING, null, tomorrow)));
        var result = service.management(OWNER, BRANCH, null, 0);
        assertEquals(1, result.todaysAppointments().size());
        var item = result.todaysAppointments().getFirst();
        assertEquals("today", item.id());
        assertEquals(tomorrow, item.startAt());
        assertEquals(dayStart, item.approvedAt());
        assertEquals("manager", item.approvedBy());
        assertEquals("Quản lý", item.approvedByName());
        assertEquals("Người yêu cầu", item.tenantName());
        assertEquals("P.101", item.roomNumber());
    }
    @Test void activitiesKeepEveryDecisionAcrossModulesAfterTheRequestChangesStatus() {
        scope();
        when(slots.readForOverview(anyList())).thenReturn(List.of(
                new RoomSlotService.OverviewSlot(SLOT, ROOM, "S01", RoomSlotStatus.AVAILABLE, null)));
        when(appointments.readForOverview(anyList())).thenReturn(List.of(
                overviewAppointment("viewing", AppointmentStatus.CANCELLED, NOW.minusSeconds(60), NOW.plusSeconds(86400))));
        when(bookings.readForOverview(anyList())).thenReturn(List.of(new BookingService.OverviewBooking(
                "booking", "tenant", SLOT, List.of(SLOT), null, null, null, null, null, BookingStatus.REJECTED)));
        when(contracts.readForOverview(anyList())).thenReturn(List.of(activeContract("contract", "tenant", LocalDate.of(2026, 12, 1))));
        when(serviceRequests.readForOverview(anyList())).thenReturn(List.of(new ServiceRequestService.OverviewServiceRequest(
                ROOM, ServiceRequestStatus.REJECTED, "service", "Người thuê", "Gửi xe", "S01")));
        when(reports.readForOverview(anyList())).thenReturn(List.of(new ReportRequestService.OverviewReport(
                ROOM, ReportRequestStatus.RESOLVED, "report", "Sửa vòi nước", "tenant")));
        when(appointments.readActivitiesForOverview(anyList(), any(), any())).thenReturn(List.of(
                new ActivitySnapshot("approved", "viewing", "APPROVED", NOW.minusSeconds(60), "manager", "Quản lý", null),
                new ActivitySnapshot("cancelled", "viewing", "CANCELLED", NOW, "manager", "Quản lý", "Khách không còn nhu cầu"),
                new ActivitySnapshot("foreign", "another-branch", "APPROVED", NOW, null, null, null),
                new ActivitySnapshot("yesterday", "viewing", "APPROVED", Instant.parse("2026-11-14T16:59:59Z"), null, null, null)));
        when(bookings.readActivitiesForOverview(anyList(), any(), any())).thenReturn(List.of(
                new ActivitySnapshot("terms", "booking", "AWAITING_PAYMENT", NOW.minusSeconds(30), null, null, null),
                new ActivitySnapshot("rejected", "booking", "REJECTED", NOW.minusSeconds(20), null, null, "Không thể đáp ứng")));
        when(contracts.readActivitiesForOverview(anyList(), any(), any())).thenReturn(List.of(
                new ActivitySnapshot("evidence", "contract", "APPROVED", NOW.minusSeconds(40), null, null, null)));
        when(serviceRequests.readActivitiesForOverview(anyList(), any(), any())).thenReturn(List.of(
                new ActivitySnapshot("decision", "service", "REJECTED", NOW.minusSeconds(10), "manager", null, null)));
        when(reportRecords.readActivitiesForOverview(anyList(), any(), any())).thenReturn(List.of(
                new ActivitySnapshot("resolved", "report", "RESOLVED", NOW.minusSeconds(5), "manager", "Quản lý", null)));
        var first = service.management(OWNER, BRANCH, YearMonth.of(2025, 1), 0, 0);
        var second = service.management(OWNER, BRANCH, YearMonth.of(2025, 1), 0, 1);
        var third = service.management(OWNER, BRANCH, YearMonth.of(2025, 1), 0, 2);
        assertEquals(7, first.todaysActivities().getTotalElements());
        assertEquals(3, first.todaysActivities().getContent().size());
        assertEquals(3, second.todaysActivities().getContent().size());
        assertEquals(1, third.todaysActivities().getContent().size());
        assertEquals(3, first.todaysActivities().getTotalPages());
        assertEquals("CANCELLED", first.todaysActivities().getContent().getFirst().action());
        assertEquals("APPROVED", third.todaysActivities().getContent().getLast().action());
        var kinds = java.util.stream.Stream.of(first, second, third).flatMap(result -> result.todaysActivities().getContent().stream())
                .map(item -> item.kind()).collect(java.util.stream.Collectors.toSet());
        assertEquals(java.util.Set.of("appointment", "booking", "contract", "service", "support"), kinds);
        assertEquals("2025-01", first.period());
        assertEquals(LocalDate.of(2026, 11, 15), first.asOfDate());
        verify(reportRecords, times(3)).readActivitiesForOverview(eq(List.of("report")),
                eq(Instant.parse("2026-11-14T17:00:00Z")), eq(Instant.parse("2026-11-15T17:00:00Z")));
    }
    private AppointmentService.OverviewAppointment overviewAppointment(String id, AppointmentStatus status, Instant approvedAt, Instant start) {
        return new AppointmentService.OverviewAppointment(id, ROOM, LocalDate.of(2026, 11, 16), start, start.plusSeconds(7200),
                com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType.MORNING,
                status, "Người yêu cầu", "0901000004", approvedAt, "manager", "Quản lý");
    }
    @Test void expiryUsesCalendarMonthIncludingClampedMonthEnd() {
        assertFalse(DashboardServiceImpl.expiring(LocalDate.of(2026, 12, 15), LocalDate.of(2026, 11, 14)));
        assertTrue(DashboardServiceImpl.expiring(LocalDate.of(2026, 12, 15), LocalDate.of(2026, 11, 15)));
        assertTrue(DashboardServiceImpl.expiring(LocalDate.of(2026, 3, 31), LocalDate.of(2026, 2, 28)));
        assertFalse(DashboardServiceImpl.expiring(LocalDate.of(2026, 11, 14), LocalDate.of(2026, 11, 15)));
    }
    @Test void expiredContractsAreNotIncludedAndExpiryListIsPaginated() {
        scope();
        var list = new java.util.ArrayList<ContractService.OverviewContract>();
        for (int i = 0; i < 7; i++) list.add(activeContract("c" + i, "tenant", LocalDate.of(2026, 12, 1).plusDays(i)));
        list.add(new ContractService.OverviewContract("ended", ROOM, "tenant", null, "END", ContractStatus.TERMINATED, null, LocalDate.of(2026, 12, 1), null));
        when(contracts.readForOverview(anyList())).thenReturn(list);
        var result = service.management(OWNER, BRANCH, null, 1);
        assertEquals(7, result.expiringContracts().getTotalElements());
        assertEquals(2, result.expiringContracts().getContent().size());
        assertEquals("c5", result.expiringContracts().getContent().getFirst().id());
    }
    private ContractService.OverviewContract activeContract(String id, String tenant, LocalDate end) {
        return new ContractService.OverviewContract(id, ROOM, tenant, null, "HD-" + id, ContractStatus.ACTIVE, LocalDate.of(2026, 11, 1), end, null);
    }
}
