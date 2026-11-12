package com.kitolam.rentalroommanagement.modules.dashboard.dto.response;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ManagementOverviewResponse(
        String period, LocalDate asOfDate, Instant generatedAt, List<BranchOption> branchOptions,
        Metrics metrics, SlotSummary slots, List<WorkItem> pending,
        List<AppointmentItem> todaysAppointments, List<MoveInItem> upcomingMoveIns,
        PagedResponse<ExpiringContract> expiringContracts, List<BranchRow> branches,
        PagedResponse<ActivityItem> todaysActivities) {

    public record BranchOption(String id, String name) { }
    public record ActivityItem(String id, String kind, String action, String label, Instant at,
                               String branchId, String branchName, String roomNumber, String subjectName,
                               String actorAccountId, String actorName, String note, String route) { }
    public record Metrics(long occupiedSlots, long availableSlots, long activeTenants, BigDecimal receipts) { }
    public record SlotSummary(long total, long operational, long occupied, long held, long available,
                              long maintenance, long inactive) { }
    public record WorkItem(String key, String label, long count, String route, String status) { }
    public record AppointmentItem(String id, String branchId, String branchName, String roomNumber,
                                  Instant startAt, Instant endAt,
                                  com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType shiftType,
                                  String tenantName, String phone, Instant approvedAt,
                                  String approvedBy, String approvedByName) { }
    public record MoveInItem(String id, String branchId, String branchName, String roomNumber,
                             String slotCodes, LocalDate date, String tenantName, String phone) { }
    public record ExpiringContract(String id, String contractNumber, String branchId, String branchName,
                                   String roomNumber, String tenantName, String phone,
                                   LocalDate endDate, long daysRemaining) { }
    public record BranchRow(String id, String name, String managerName, long totalRooms,
                             long operationalSlots, long occupiedSlots, long availableSlots,
                             long activeTenants, BigDecimal receipts, long pendingCount) { }
}
