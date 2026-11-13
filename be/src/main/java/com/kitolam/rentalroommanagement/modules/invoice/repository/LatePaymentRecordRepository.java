package com.kitolam.rentalroommanagement.modules.invoice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.LatePaymentRecord;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LatePaymentRecordRepository extends BaseRepository<LatePaymentRecord> {

    Optional<LatePaymentRecord> findByContractIdAndPeriodAndIsDeletedFalse(String contractId, String period);

    List<LatePaymentRecord> findByContractIdInAndIsDeletedFalse(Collection<String> contractIds);
}
