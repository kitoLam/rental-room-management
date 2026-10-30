package com.kitolam.rentalroommanagement.modules.contracttenant.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;

public interface ContractTenantRepository extends BaseRepository<ContractTenant> {
    java.util.Optional<ContractTenant> findByBookingIdAndIsDeletedFalse(String bookingId);
}
