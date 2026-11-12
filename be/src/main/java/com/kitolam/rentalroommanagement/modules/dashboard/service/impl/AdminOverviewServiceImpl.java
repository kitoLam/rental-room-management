package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminAccountStatistics;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.AdminOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.AdminOverviewResponse.StatusCount;
import com.kitolam.rentalroommanagement.modules.dashboard.service.AdminOverviewService;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Reads bounded projections; never changes accounts, inventory or workflow state. */
@Service
@RequiredArgsConstructor
public class AdminOverviewServiceImpl implements AdminOverviewService {
    private final AuthService accounts;
    private final BranchService branches;
    private final RoomService rooms;
    private final RoomSlotService slots;
    private final Clock clock;

    @Override
    public AdminOverviewResponse overview(AuthPrincipal principal, Integer year) {
        if (principal == null || !principal.enabled() || !"ADMIN".equals(principal.role()))
            throw new ForbiddenException("Chỉ Admin được xem tổng quan hệ thống");
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, ZoneId.of("Asia/Ho_Chi_Minh"));
        int selectedYear = year == null ? today.getYear() : year;
        if (selectedYear < 1900 || selectedYear > 9998)
            throw new BadRequestException("Năm thống kê phải từ 1900 đến 9998");
        var users = accounts.readStatisticsForAdmin(selectedYear);
        var branchData = branches.readStatisticsForAdmin();
        var branchCounts = branchData.statuses().stream().map(s -> new StatusCount(s.status(), s.count())).toList();
        var roomCounts = rooms.readStatusTotalsForAdmin().stream().map(s -> new StatusCount(s.status(), s.count())).toList();
        var slotCounts = slots.readStatusTotalsForAdmin().stream().map(s -> new StatusCount(s.status(), s.count())).toList();
        var roleTotals = new LinkedHashMap<String, Long>();
        List.of("TENANT", "OWNER", "MANAGER", "ADMIN").forEach(role -> roleTotals.put(role, 0L));
        users.roles().forEach(role -> roleTotals.merge(role.role(), role.count(), Long::sum));
        var growth = IntStream.rangeClosed(1, 12).mapToObj(month -> new AdminAccountStatistics.MonthCount(month,
                users.registrations().stream().filter(m -> m.month() == month).mapToLong(AdminAccountStatistics.MonthCount::count).sum())).toList();
        return new AdminOverviewResponse(selectedYear, today, now,
                new AdminOverviewResponse.Metrics(users.total(), users.active(), sum(branchCounts),
                        branchCounts.stream().filter(s -> "ACTIVE".equals(s.status())).mapToLong(StatusCount::count).sum(),
                        sum(roomCounts), sum(slotCounts)),
                roleTotals.entrySet().stream().map(e -> new AdminAccountStatistics.RoleCount(e.getKey(), e.getValue())).toList(),
                List.of(new StatusCount("ACTIVE", users.active()), new StatusCount("UNVERIFIED", users.unverified()),
                        new StatusCount("INACTIVE", users.inactive())),
                growth, withZeros(List.of("ACTIVE", "INACTIVE"), branchCounts),
                withZeros(List.of("AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE", "INACTIVE"), roomCounts),
                withZeros(List.of("AVAILABLE", "OCCUPIED", "MAINTENANCE", "INACTIVE"), slotCounts),
                users.recent(), branchData.recent());
    }

    private static long sum(List<StatusCount> values) {
        return values.stream().mapToLong(StatusCount::count).sum();
    }

    private static List<StatusCount> withZeros(List<String> keys, List<StatusCount> values) {
        var result = new LinkedHashMap<String, Long>();
        keys.forEach(key -> result.put(key, 0L));
        values.forEach(value -> result.merge(value.status() == null ? "UNKNOWN" : value.status(), value.count(), Long::sum));
        return result.entrySet().stream().map(e -> new StatusCount(e.getKey(), e.getValue())).toList();
    }
}
