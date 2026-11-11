package com.kitolam.rentalroommanagement.modules.invoice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceKind;

import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends BaseRepository<Invoice> {

    Optional<Invoice> findByContractIdAndPeriodAndKindAndIsDeletedFalse(String contractId, String period, InvoiceKind kind);

    /** Every live invoice (monthly + supplementary) of a contract for a period. */
    List<Invoice> findByContractIdAndPeriodAndIsDeletedFalse(String contractId, String period);
}
