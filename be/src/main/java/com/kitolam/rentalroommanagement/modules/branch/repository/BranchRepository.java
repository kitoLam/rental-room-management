package com.kitolam.rentalroommanagement.modules.branch.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;

public interface BranchRepository extends BaseRepository<Branch> {
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { isDeleted: false } }",
        "{ $group: { _id: '$status', count: { $sum: 1 } } }",
        "{ $project: { _id: 0, status: '$_id', count: 1 } }"
    })
    java.util.List<com.kitolam.rentalroommanagement.modules.branch.dto.response.AdminBranchStatistics.StatusTotal> readStatusTotalsForAdmin();

    @org.springframework.data.mongodb.repository.Query(value = "{ isDeleted: false }",
            fields = "{ name: 1, status: 1, createdAt: 1 }")
    java.util.List<Branch> readRecentForAdmin(org.springframework.data.domain.Pageable pageable);

    java.util.List<Branch> findByOwnerAccountIdAndIsDeletedFalse(String ownerAccountId);
}
