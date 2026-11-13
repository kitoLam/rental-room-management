package com.kitolam.rentalroommanagement.modules.contract.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;

import java.util.Optional;

public interface ContractRepository extends BaseRepository<Contract> {
    /** A booking produces one contract per slot. */
    java.util.List<Contract> findAllByBookingIdAndIsDeletedFalse(String bookingId);

    Optional<Contract> findFirstByRoomSlotIdAndStatusAndIsDeletedFalse(String roomSlotId, ContractStatus status);

    /** Mọi hợp đồng (chưa xoá) gắn với một slot — dùng để kiểm tra slot đã có claim khác khi gia hạn. */
    java.util.List<Contract> findByRoomSlotIdAndIsDeletedFalse(String roomSlotId);

    /** Hợp đồng đang hiệu lực và đã quá endDate trước mốc cho trước (job expire). */
    java.util.List<Contract> findByStatusAndEndDateBeforeAndIsDeletedFalse(
            com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status, java.time.LocalDate date);

    /** Hợp đồng còn hiệu lực (theo ngày) với endDate trong [from, to] — job thông báo sắp hết hạn. */
    java.util.List<Contract> findByStatusAndEndDateBetweenAndIsDeletedFalse(
            com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status, java.time.LocalDate from, java.time.LocalDate to);

    java.util.List<Contract> findByRoomIdInAndIsDeletedFalse(java.util.Collection<String> roomIds);

    java.util.List<Contract> findByStatusAndEvidenceDeadlineLessThanEqualAndIsDeletedFalse(
            com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status, java.time.Instant deadline);

    boolean existsByContractNumberAndIsDeletedFalse(String contractNumber);
}
