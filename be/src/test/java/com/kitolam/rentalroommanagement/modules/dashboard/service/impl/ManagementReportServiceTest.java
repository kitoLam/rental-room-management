package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService.ReportContract;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.request.ManagementReportRequest;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.invoice.service.impl.InvoiceServiceImpl;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.payment.service.impl.PaymentServiceImpl;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManagementReportServiceTest {
    private static final String BRANCH = "710000000000000000000001";
    private static final String ROOM = "710000000000000000000002";
    private static final AuthPrincipal OWNER = new AuthPrincipal("owner", "owner@test.local", "OWNER");
    private static final Instant NOW = Instant.parse("2026-11-15T03:00:00Z");
    @Mock BranchService branches;
    @Mock RoomService rooms;
    @Mock ContractService contracts;
    @Mock ContractTenantService tenancies;
    @Mock InvoiceService invoices;
    @Mock PaymentService payments;
    ManagementReportServiceImpl service;

    @BeforeEach void setup() {
        service = new ManagementReportServiceImpl(branches, rooms, contracts, tenancies, invoices, payments,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }
    ManagementReportRequest request() {
        var request = new ManagementReportRequest();
        request.setFromMonth("2026-11"); request.setToMonth("2026-11");
        return request;
    }
    RoomResponse room(String id) {
        RoomResponse room = mock(RoomResponse.class);
        when(room.id()).thenReturn(id);
        lenient().when(room.branchId()).thenReturn(BRANCH);
        lenient().when(room.roomNumber()).thenReturn("P." + id);
        return room;
    }
    void scope(List<RoomResponse> roomList) {
        when(branches.managedBranches(any())).thenReturn(List.of(new BranchResponse(BRANCH, "Cơ sở 1", "Địa chỉ",
                null, null, null, BranchStatus.ACTIVE, null, null, "owner", null, null, null)));
        when(rooms.listByBranch(eq(BRANCH), any(Pageable.class))).thenReturn(PagedResponse.of(roomList, 1, 100, roomList.size()));
    }
    ReportContract contract(String id, ContractStatus status, String start, Instant terminatedAt, List<String> slots) {
        return new ReportContract(id, ROOM, status, LocalDate.parse(start), LocalDate.of(2027, 1, 1), terminatedAt, slots);
    }

    @Test void rejectsTenantBeforeReadingData() {
        assertThrows(ForbiddenException.class, () -> service.report(new AuthPrincipal("tenant", "t@test.local", "TENANT"), request()));
        verifyNoInteractions(branches, rooms, contracts, payments);
    }
    @Test void rejectsUnownedBranchBeforeReadingRooms() {
        when(branches.managedBranches(OWNER)).thenReturn(List.of());
        var request = request(); request.setBranchId(BRANCH);
        assertThrows(ForbiddenException.class, () -> service.report(OWNER, request));
        verifyNoInteractions(rooms, contracts, payments);
    }
    @Test void rejectsRoomOutsideSelectedScope() {
        scope(List.of(room(ROOM)));
        var request = request(); request.setRoomId("foreign-room");
        assertThrows(ForbiddenException.class, () -> service.report(OWNER, request));
        verifyNoInteractions(contracts, tenancies, invoices, payments);
    }
    @Test void validatesMonthRangeAndPaginationBeforeReadingData() {
        var request = request(); request.setFromMonth("2026-13");
        assertThrows(BadRequestException.class, () -> service.report(OWNER, request));
        request.setFromMonth("2025-01");
        assertThrows(BadRequestException.class, () -> service.report(OWNER, request));
        request.setFromMonth("2026-12");
        assertThrows(BadRequestException.class, () -> service.report(OWNER, request));
        request.setFromMonth("2026-11"); request.setPage(-1);
        assertThrows(BadRequestException.class, () -> service.report(OWNER, request));
        verifyNoInteractions(branches, rooms, payments);
    }
    @Test void scopesReceiptsThroughInvoiceAndGroupsAtVietnamMonthBoundary() {
        scope(List.of(room(ROOM)));
        when(contracts.readForReports(anyList())).thenReturn(List.of(contract("c1", ContractStatus.ACTIVE, "2026-01-01", null, List.of("s1"))));
        when(tenancies.readForOverview(List.of("c1"))).thenReturn(List.of(
                new ContractTenantService.OverviewTenancy("ct1", "c1", "t1", null, null, null),
                new ContractTenantService.OverviewTenancy("foreign", "other-contract", "t2", null, null, null)));
        when(invoices.readForReports(List.of("ct1"))).thenReturn(List.of(new InvoiceService.OverviewInvoice("i1", "ct1")));
        when(payments.readForReports(anyList(), any(), any())).thenReturn(List.of(
                new PaymentService.ReportPayment("i1", new BigDecimal("300"), Instant.parse("2026-10-31T17:00:00Z")),
                new PaymentService.ReportPayment("i1", new BigDecimal("200"), Instant.parse("2026-10-31T16:59:59Z")),
                new PaymentService.ReportPayment("foreign-invoice", new BigDecimal("999"), NOW),
                new PaymentService.ReportPayment("i1", new BigDecimal("999"), NOW.plusSeconds(1))));
        var result = service.report(OWNER, request());
        assertEquals(new BigDecimal("300"), result.metrics().receipts());
        assertEquals(new BigDecimal("200"), result.metrics().previousReceipts());
        assertEquals(new BigDecimal("300"), result.months().getFirst().receipts());
        assertEquals(new BigDecimal("100.00"), result.topReceipts().getFirst().receiptShare());
        assertEquals(0, result.metrics().newLeases());
        verify(payments).readForReports(List.of("i1"), Instant.parse("2026-09-30T17:00:00Z"), NOW.plusNanos(1));
    }
    @Test void countsEffectiveLeasesOnceAndTracksUnknownLegacySlots() {
        scope(List.of(room(ROOM)));
        when(contracts.readForReports(anyList())).thenReturn(List.of(
                contract("active", ContractStatus.ACTIVE, "2026-11-01", null, List.of("s1", "s1", "s2")),
                contract("ended", ContractStatus.EXPIRED, "2026-11-02", null, List.of()),
                contract("terminated", ContractStatus.TERMINATED, "2026-11-03", NOW, List.of("s1")),
                contract("draft", ContractStatus.DRAFT, "2026-11-04", null, List.of("s2")),
                contract("future", ContractStatus.ACTIVE, "2026-11-20", null, List.of("s2")),
                contract("neverStarted", ContractStatus.TERMINATED, "2026-11-10", Instant.parse("2026-11-09T00:00:00Z"), List.of("s2"))));
        var result = service.report(OWNER, request());
        assertEquals(3, result.metrics().newLeases());
        assertEquals(3, result.metrics().leasedSlots());
        assertEquals(1, result.metrics().unknownSlotContracts());
        assertEquals(3, result.topRentals().getFirst().newLeases());
        assertTrue(result.topReceipts().isEmpty());
    }
    @Test void paginatesAllRoomsAndDoesNotExposeOwnerComparisonToManager() {
        scope(IntStream.rangeClosed(1, 11).mapToObj(i -> room("room" + i)).toList());
        var request = request(); request.setPage(1); request.setSort("roomNumber");
        var result = service.report(new AuthPrincipal("manager", "m@test.local", "MANAGER"), request);
        assertEquals(11, result.rooms().getTotalElements());
        assertEquals(2, result.rooms().getNumber());
        assertEquals(1, result.rooms().getContent().size());
        assertTrue(result.branches().isEmpty());
        assertTrue(result.topRentals().isEmpty());
    }
    @Test void paymentReadExcludesDepositsFailuresAndRefundedTransactionsWithoutWriting() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        PaymentRepository repository = mock(PaymentRepository.class);
        when(mongo.find(any(Query.class), eq(Payment.class))).thenReturn(List.of());
        var service = new PaymentServiceImpl(mongo, repository);
        service.readForReports(List.of("710000000000000000000003"), NOW.minusSeconds(1), NOW);
        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongo).find(captor.capture(), eq(Payment.class));
        var criteria = captor.getValue().getQueryObject();
        assertEquals(List.of("SUCCESS", "LATE_PAID"), ((org.bson.Document) criteria.get("status")).get("$in"));
        assertTrue(criteria.containsKey("bookingId"));
        assertNull(criteria.get("bookingId"));
        assertEquals(false, criteria.get("isDeleted"));
        assertEquals(NOW, ((org.bson.Document) criteria.get("paidAt")).get("$lt"));
        verifyNoInteractions(repository);
        verifyNoMoreInteractions(mongo);
    }
    @Test void invoiceReadExcludesDraftsCancelledAndMixedDepositInvoicesWithoutWriting() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        InvoiceRepository repository = mock(InvoiceRepository.class);
        when(mongo.find(any(Query.class), eq(Invoice.class))).thenReturn(List.of());
        new InvoiceServiceImpl(mongo, repository).readForReports(List.of("710000000000000000000003"));
        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongo).find(captor.capture(), eq(Invoice.class));
        var criteria = captor.getValue().getQueryObject();
        assertEquals(List.of("DRAFT", "CANCELLED"), ((org.bson.Document) criteria.get("status")).get("$nin"));
        assertEquals("DEPOSIT", ((org.bson.Document) criteria.get("items.type")).get("$ne"));
        assertEquals(false, criteria.get("isDeleted"));
        verifyNoInteractions(repository);
        verifyNoMoreInteractions(mongo);
    }
}
