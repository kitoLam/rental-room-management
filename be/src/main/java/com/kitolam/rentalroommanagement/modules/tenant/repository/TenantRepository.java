package com.kitolam.rentalroommanagement.modules.tenant.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;

public interface TenantRepository extends BaseRepository<Tenant> {
    java.util.Optional<Tenant> findByEmailAndIsDeletedFalse(String email);
    java.util.Optional<Tenant> findByPhoneAndIsDeletedFalse(String phone);
    java.util.List<Tenant> findByEmailInAndIsDeletedFalse(java.util.Collection<String> emails);
    java.util.List<Tenant> findByIsDeletedFalse();
}
