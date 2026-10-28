package com.kitolam.rentalroommanagement.modules.branch.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;

public interface BranchRepository extends BaseRepository<Branch> {
    java.util.List<Branch> findByOwnerAccountIdAndIsDeletedFalse(String ownerAccountId);
}
