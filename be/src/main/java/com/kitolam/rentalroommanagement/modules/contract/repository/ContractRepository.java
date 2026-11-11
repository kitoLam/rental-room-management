package com.kitolam.rentalroommanagement.modules.contract.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;

public interface ContractRepository extends BaseRepository<Contract> {
    java.util.Optional<Contract> findByBookingIdAndIsDeletedFalse(String bookingId);

    java.util.List<Contract> findByRoomIdInAndIsDeletedFalse(java.util.Collection<String> roomIds);

    java.util.List<Contract> findByStatusAndEvidenceDeadlineLessThanEqualAndIsDeletedFalse(
            com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status, java.time.Instant deadline);

    boolean existsByContractNumberAndIsDeletedFalse(String contractNumber);
}
