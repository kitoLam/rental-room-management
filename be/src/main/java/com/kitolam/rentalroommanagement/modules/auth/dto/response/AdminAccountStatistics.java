package com.kitolam.rentalroommanagement.modules.auth.dto.response;

import java.time.Instant;
import java.util.List;

public record AdminAccountStatistics(long total, long active, long unverified, long inactive,
        List<RoleCount> roles, List<MonthCount> registrations, List<RecentAccount> recent) {
    public record Group(String role, Boolean enabled, Boolean emailVerified, long count) { }
    public record RoleCount(String role, long count) { }
    public record MonthCount(int month, long count) { }
    public record RecentAccount(String id, String fullName, String role, Instant createdAt) { }
}
