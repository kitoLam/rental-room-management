package com.kitolam.rentalroommanagement.modules.dashboard.dto.response;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ManagementReportResponse(
        String fromMonth, String toMonth, Instant generatedAt,
        List<BranchOption> branchOptions, List<RoomOption> roomOptions,
        Metrics metrics, List<MonthlyRow> months,
        List<RoomRow> topReceipts, List<RoomRow> topRentals,
        PagedResponse<RoomRow> rooms, List<BranchRow> branches) {
    public record BranchOption(String id, String name) { }
    public record RoomOption(String id, String branchId, String roomNumber) { }
    public record Metrics(BigDecimal receipts, BigDecimal previousReceipts, long newLeases,
                          long leasedSlots, long unknownSlotContracts) { }
    public record MonthlyRow(String month, BigDecimal receipts, long newLeases) { }
    public record RoomRow(String id, String roomNumber, String branchId, String branchName,
                          BigDecimal receipts, BigDecimal receiptShare, long newLeases,
                          long leasedSlots, long unknownSlotContracts, List<BigDecimal> monthlyReceipts) { }
    public record BranchRow(String id, String name, long roomCount, BigDecimal receipts,
                            long newLeases, long leasedSlots, long unknownSlotContracts) { }
}
