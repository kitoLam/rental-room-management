package com.kitolam.rentalroommanagement.modules.dashboard.dto.response;

import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminAccountStatistics;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.AdminBranchStatistics;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record AdminOverviewResponse(int year, LocalDate today, Instant updatedAt, Metrics metrics,
        List<AdminAccountStatistics.RoleCount> roles, List<StatusCount> accounts,
        List<AdminAccountStatistics.MonthCount> registrations, List<StatusCount> branches,
        List<StatusCount> rooms, List<StatusCount> slots,
        List<AdminAccountStatistics.RecentAccount> recentAccounts,
        List<AdminBranchStatistics.RecentBranch> recentBranches) {
    public record Metrics(long totalAccounts, long activeAccounts, long totalBranches, long activeBranches,
                          long totalRooms, long totalSlots) { }
    public record StatusCount(String status, long count) { }
}
