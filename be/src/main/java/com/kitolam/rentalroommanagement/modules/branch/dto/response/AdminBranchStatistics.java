package com.kitolam.rentalroommanagement.modules.branch.dto.response;

import java.time.Instant;
import java.util.List;

public record AdminBranchStatistics(List<StatusTotal> statuses, List<RecentBranch> recent) {
    public record StatusTotal(String status, long count) { }
    public record RecentBranch(String id, String name, String status, Instant createdAt) { }
}
