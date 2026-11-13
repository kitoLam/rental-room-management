package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService.OverviewContract;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.DebtItemResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.service.DebtOverviewService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService.OverviewTenant;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/** Read-only debt projection built from public service interfaces of the owning modules. */
@Service
@RequiredArgsConstructor
public class DebtOverviewServiceImpl implements DebtOverviewService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGE_SIZE = 100;
    private final BranchService branches;
    private final RoomService rooms;
    private final ContractService contracts;
    private final ContractTenantService tenancies;
    private final TenantService tenants;
    private final InvoiceService invoices;
    private final Clock clock;

    @Override
    public PagedResponse<DebtItemResponse> debts(AuthPrincipal principal, String branchId, String roomId,
            String contractTenantId, String keyword, boolean overdueOnly, int page, int size) {
        if (principal == null || !principal.enabled() || !Set.of("OWNER", "MANAGER").contains(principal.role()))
            throw new ForbiddenException("Chỉ Owner/Manager được xem công nợ");
        if (page < 1 || page > 10000) throw new BadRequestException("Trang không hợp lệ");
        if (size < 1 || size > MAX_PAGE_SIZE) throw new BadRequestException("Kích thước trang không hợp lệ");
        var allowed = branches.managedBranches(principal);
        if (branchId != null && allowed.stream().noneMatch(b -> b.id().equals(branchId)))
            throw new ForbiddenException("Bạn không có quyền xem chi nhánh này");
        var selected = allowed.stream().filter(b -> branchId == null || b.id().equals(branchId)).toList();
        var branchById = selected.stream().collect(Collectors.toMap(BranchResponse::id, Function.identity()));

        var roomById = new java.util.HashMap<String, RoomResponse>();
        for (var branch : selected) {
            for (int p = 0; ; p++) {
                var data = rooms.listByBranch(branch.id(), PageRequest.of(p, 100, Sort.by("_id")));
                data.getContent().forEach(r -> roomById.put(r.id(), r));
                if (p + 1 >= data.getTotalPages()) break;
            }
        }
        var contractList = contracts.readForOverview(new ArrayList<>(roomById.keySet()));
        var contractById = contractList.stream().collect(Collectors.toMap(OverviewContract::id, Function.identity()));
        var tenancyList = tenancies.readForOverview(new ArrayList<>(contractById.keySet())).stream()
                .filter(t -> contractTenantId == null || contractTenantId.equals(t.id())).toList();
        // Invoices belong to a contract; show them under its (first) tenancy record.
        var tenancyByContract = tenancyList.stream().collect(Collectors.toMap(t -> t.contractId(), Function.identity(), (a, b) -> a));
        var tenantIds = new HashSet<String>();
        tenancyList.forEach(t -> { if (t.tenantId() != null) tenantIds.add(t.tenantId()); });
        Map<String, OverviewTenant> tenantById = tenants.readForOverview(new ArrayList<>(tenantIds)).stream()
                .collect(Collectors.toMap(OverviewTenant::id, Function.identity()));

        LocalDate today = LocalDate.ofInstant(clock.instant(), ZONE);
        String needle = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        var items = new ArrayList<DebtItemResponse>();
        for (var invoice : invoices.readDebts(new ArrayList<>(tenancyByContract.keySet()))) {
            var tenancy = tenancyByContract.get(invoice.contractId());
            var contract = tenancy == null ? null : contractById.get(tenancy.contractId());
            var room = contract == null ? null : roomById.get(contract.roomId());
            if (room == null || (roomId != null && !roomId.equals(room.id()))) continue;
            var tenant = tenantById.get(tenancy.tenantId());
            var branch = branchById.get(room.branchId());
            long overdueDays = invoice.dueDate() != null && invoice.dueDate().isBefore(today)
                    ? ChronoUnit.DAYS.between(invoice.dueDate(), today) : 0;
            if (overdueOnly && overdueDays == 0) continue;
            String name = tenant == null ? "Người thuê" : Objects.toString(tenant.fullName(), "Người thuê");
            String phone = tenant == null ? null : tenant.phone();
            if (!needle.isEmpty() && !(name + " " + Objects.toString(phone, "") + " " + Objects.toString(invoice.invoiceNumber(), "")
                    + " " + Objects.toString(room.roomNumber(), "")).toLowerCase(Locale.ROOT).contains(needle)) continue;
            String status = overdueDays > 0 ? "OVERDUE"
                    : invoice.totalAmount() != null && invoice.remainingAmount().compareTo(invoice.totalAmount()) < 0
                            ? "PARTIAL" : "UNPAID";
            items.add(new DebtItemResponse(invoice.id(), tenancy.id(), name, phone, room.id(),
                    room.roomNumber(), room.branchId(), branch == null ? null : branch.name(), invoice.invoiceNumber(),
                    invoice.period(), invoice.dueDate(), invoice.totalAmount(), invoice.remainingAmount(), status, overdueDays));
        }
        items.sort(Comparator.comparingLong(DebtItemResponse::overdueDays).reversed()
                .thenComparing(DebtItemResponse::dueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(DebtItemResponse::invoiceId));
        int from = Math.min((page - 1) * size, items.size());
        return PagedResponse.of(List.copyOf(items.subList(from, Math.min(from + size, items.size()))), page, size, items.size());
    }
}
