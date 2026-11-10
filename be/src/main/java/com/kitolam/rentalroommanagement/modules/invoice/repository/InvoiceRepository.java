package com.kitolam.rentalroommanagement.modules.invoice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;

import java.util.Optional;

public interface InvoiceRepository extends BaseRepository<Invoice> {

    Optional<Invoice> findByContractIdAndPeriodAndIsDeletedFalse(String contractId, String period);
}
