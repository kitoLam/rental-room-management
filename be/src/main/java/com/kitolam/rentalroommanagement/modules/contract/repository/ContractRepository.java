package com.kitolam.rentalroommanagement.modules.contract.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;

public interface ContractRepository extends BaseRepository<Contract> {
    java.util.Optional<Contract> findByBookingIdAndIsDeletedFalse(String bookingId);

    boolean existsByContractNumberAndIsDeletedFalse(String contractNumber);
}
