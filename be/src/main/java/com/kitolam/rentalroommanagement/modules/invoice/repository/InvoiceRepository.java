package com.kitolam.rentalroommanagement.modules.invoice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;

import java.util.Collection;
import java.util.List;

public interface InvoiceRepository extends BaseRepository<Invoice> {

    List<Invoice> findByContractIdInAndPeriodAndIsDeletedFalse(Collection<String> contractIds, String period);

    List<Invoice> findByBranchIdAndPeriodAndIsDeletedFalse(String branchId, String period);
}
