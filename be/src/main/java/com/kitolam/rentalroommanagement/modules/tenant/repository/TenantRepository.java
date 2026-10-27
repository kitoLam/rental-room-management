package com.kitolam.rentalroommanagement.modules.tenant.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;

import java.util.Optional;

public interface TenantRepository extends BaseRepository<Tenant> {

    Optional<Tenant> findByEmailAndIsDeletedFalse(String email);

    boolean existsByEmailAndIsDeletedFalse(String email);

    boolean existsByPhoneAndIsDeletedFalse(String phone);

    boolean existsByIdCardNumberAndIsDeletedFalse(String idCardNumber);
}
