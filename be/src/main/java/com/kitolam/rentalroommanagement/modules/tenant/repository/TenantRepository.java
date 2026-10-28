package com.kitolam.rentalroommanagement.modules.tenant.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;

public interface TenantRepository extends BaseRepository<Tenant> {
    java.util.Optional<Tenant> findByEmailAndIsDeletedFalse(String email);
}
