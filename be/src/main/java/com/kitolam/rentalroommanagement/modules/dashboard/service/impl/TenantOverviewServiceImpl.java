package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.TenantOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.TenantOverviewResponse.Lease;
import com.kitolam.rentalroommanagement.modules.dashboard.service.TenantOverviewService;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService.TenantInvoice;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationScope;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.service.SlotServiceRequestService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/** Coordinates read-only projections. No billing, payment, contract or request transitions happen here. */
@Service
@RequiredArgsConstructor
public class TenantOverviewServiceImpl implements TenantOverviewService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final TenantService tenants;
    private final ContractService contracts;
    private final ContractTenantService tenancies;
    private final RoomService rooms;
    private final RoomSlotService slots;
    private final BranchService branches;
    private final InvoiceService invoices;
    private final PaymentService payments;
    private final ReportRequestService support;
    private final SlotServiceRequestService serviceRequests;
    private final com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository contractRepository;
    private final NotificationService notifications;
    private final Clock clock;

    @Override
    public List<Lease> tenancies(AuthPrincipal principal) {
        requireTenant(principal);
        String tenantId = tenants.profileIdByEmail(principal.email()).orElse(null);
        if (tenantId == null) return List.of();
        var owned = tenancies.readOwnedForOverview(tenantId);
        if (owned.isEmpty()) return List.of();
        var contractById = new HashMap<String, ContractResponse>();
        for (int page = 0; ; page++) {
            var result = contracts.search(new ContractFilterRequest(null, null, null, null),
                    PageRequest.of(page, 100, Sort.by("_id")), principal);
            result.getContent().forEach(c -> contractById.put(c.id(), c));
            if (page + 1 >= result.getTotalPages()) break;
        }
        var roomIds = owned.stream().map(t -> contractById.get(t.contractId())).filter(Objects::nonNull)
                .map(ContractResponse::roomId).distinct().toList();
        var slotById = slots.readForOverview(roomIds).stream()
                .collect(Collectors.toMap(RoomSlotService.OverviewSlot::id, Function.identity()));
        var roomById = roomIds.stream().map(rooms::getById).collect(Collectors.toMap(r -> r.id(), Function.identity()));
        var branchById = roomById.values().stream().map(r -> r.branchId()).distinct().map(branches::getById)
                .collect(Collectors.toMap(b -> b.id(), Function.identity()));
        var today = LocalDate.ofInstant(clock.instant(), ZONE);
        var result = new ArrayList<Lease>();
        for (var tenancy : owned) {
            var contract = contractById.get(tenancy.contractId());
            if (contract == null) continue;
            var room = roomById.get(contract.roomId());
            var branch = branchById.get(room.branchId());
            // Member slots belong to that member; never substitute a roommate's slots.
            var assigned = tenancy.roomSlotIds();
            if (assigned.isEmpty() && Boolean.TRUE.equals(tenancy.representative())) {
                assigned = contract.roomSlotIds() != null && !contract.roomSlotIds().isEmpty() ? contract.roomSlotIds()
                        : contract.roomSlotId() == null ? List.of() : List.of(contract.roomSlotId());
            }
            var ownSlots = assigned.stream().distinct().filter(id -> slotById.containsKey(id)
                    && room.id().equals(slotById.get(id).roomId())).toList();
            LocalDate start = later(contract.startDate(), tenancy.joinedAt());
            LocalDate end = earlier(contract.endDate(), tenancy.leftAt());
            String status = tenancy.status() == ContractTenantStatus.LEFT ? "LEFT"
                    : contract.status() == ContractStatus.TERMINATED ? "CANCELLED"
                    : contract.status() == ContractStatus.EXPIRED || (end != null && end.isBefore(today)) ? "LEFT"
                    : contract.status() == ContractStatus.DRAFT || start == null || start.isAfter(today) ? "DRAFT" : "ACTIVE";
            result.add(new Lease(tenancy.id(), contract.id(), contract.contractNumber(), contract.status().name(), status,
                    branch.id(), branch.name(), branch.address(), branch.phone(), room.id(), room.roomNumber(), ownSlots,
                    ownSlots.stream().map(id -> slotById.get(id).slotCode()).filter(Objects::nonNull).toList(),
                    start, end, tenancy.rentAmount(), Boolean.TRUE.equals(tenancy.representative()),
                    contract.rentPrice(), contract.contractDepositAmount(), contract.terms(), contract.signedFileUrl(), contract.signedDate()));
        }
        return result.stream().sorted(Comparator.comparing((Lease t) -> !"ACTIVE".equals(t.status()))
                .thenComparing(Lease::startDate, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(Lease::id)).toList();
    }

    @Override
    public TenantOverviewResponse overview(AuthPrincipal principal, String tenancyId) {
        var owned = tenancies(principal);
        // Old links used contractId as tenancyId; accept only an unambiguous contract owned by this account.
        Lease selected = tenancyId == null ? owned.stream().findFirst().orElse(null)
                : owned.stream().filter(t -> t.id().equals(tenancyId)).findFirst().orElse(null);
        if (tenancyId != null && selected == null) {
            var legacy = owned.stream().filter(t -> t.contractId().equals(tenancyId)).toList();
            if (legacy.size() == 1) selected = legacy.getFirst();
            else throw new ForbiddenException("Quan hệ thuê không thuộc tài khoản của bạn");
        }
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, ZONE);
        var updates = notifications.list(new NotificationScope(principal.userId(), Set.of()), null, PageRequest.of(0, 3)).getContent();
        if (selected == null) return new TenantOverviewResponse(now, today, null, null, null, null, false,
                0, 0, null, 0, List.of(), List.of(), null, updates);
        var bills = invoices.readForTenantOverview(List.of(selected.id()));
        var unpaid = bills.stream().filter(i -> i.remainingAmount() != null && i.remainingAmount().signum() > 0).toList();
        boolean incomplete = bills.stream().anyMatch(i -> i.remainingAmount() == null && i.status() != InvoiceStatus.PAID);
        var nextDue = unpaid.stream().filter(i -> i.dueDate() != null)
                .min(Comparator.comparing(TenantInvoice::dueDate).thenComparing(TenantInvoice::id)).orElse(null);
        var recentBills = bills.stream().sorted(Comparator.comparing((TenantInvoice i) ->
                        i.remainingAmount() == null || i.remainingAmount().signum() <= 0)
                .thenComparing(TenantInvoice::dueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(TenantInvoice::id)).limit(3).toList();
        var tenantIds = new ArrayList<String>();
        tenantIds.add(principal.userId());
        tenants.profileIdByEmail(principal.email()).ifPresent(tenantIds::add);
        var requests = support.readForTenantOverview(tenantIds, selected.contractId());
        long needsResponse = requests.stream().filter(r -> r.status() == ReportRequestStatus.WAITING_INFO
                || r.status() == ReportRequestStatus.RESOLVED).count();
        long openSupport = requests.stream().filter(r -> r.status() != ReportRequestStatus.CLOSED
                && r.status() != ReportRequestStatus.CANCELLED && r.status() != ReportRequestStatus.REJECTED).count();
        var recentSupport = requests.stream().sorted(Comparator.comparing(ReportRequestService.TenantSupport::updatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(ReportRequestService.TenantSupport::id)).limit(3).toList();
        long pendingServices = serviceRequests.statusesForContract(selected.contractId()).stream()
                .filter(status -> status == SlotServiceRequestStatus.PENDING).count();
        Long activeServices = null;
        if ("ACTIVE".equals(selected.status())) {
            // Services in use = services that come with the room + optional services active on the contract today.
            var room = rooms.getById(selected.roomId());
            var roomServiceIds = room == null ? null : room.roomServiceIds();
            long count = roomServiceIds == null ? 0 : roomServiceIds.size();
            count += contractRepository.findByIdAndIsDeletedFalse(selected.contractId())
                    .map(c -> c.getActiveSlotServices() == null ? 0L : c.getActiveSlotServices().stream()
                            .filter(s -> s.isActiveOn(today)).count())
                    .orElse(0L);
            activeServices = count;
        }
        var lastPayment = payments.readForReports(bills.stream().map(TenantInvoice::id).toList(), Instant.EPOCH, now.plusNanos(1))
                .stream().filter(p -> p.paidAt() != null && !p.paidAt().isAfter(now))
                .max(Comparator.comparing(PaymentService.ReportPayment::paidAt)).orElse(null);
        return new TenantOverviewResponse(now, today, selected, incomplete ? null : (long) unpaid.size(),
                nextDue == null ? null : nextDue.dueDate(), nextDue == null ? null : nextDue.remainingAmount(), incomplete,
                openSupport, needsResponse, activeServices, pendingServices, recentBills, recentSupport, lastPayment, updates);
    }

    private void requireTenant(AuthPrincipal principal) {
        if (principal == null || !principal.enabled() || !"TENANT".equals(principal.role()))
            throw new ForbiddenException("Chỉ Tenant được xem tổng quan không gian thuê");
    }
    private static boolean covers(LocalDate start, LocalDate end, LocalDate today) {
        return start != null && !start.isAfter(today) && (end == null || !end.isBefore(today));
    }
    private static LocalDate later(LocalDate a, LocalDate b) { return a == null ? b : b == null || a.isAfter(b) ? a : b; }
    private static LocalDate earlier(LocalDate a, LocalDate b) { return a == null ? b : b == null || a.isBefore(b) ? a : b; }
}
