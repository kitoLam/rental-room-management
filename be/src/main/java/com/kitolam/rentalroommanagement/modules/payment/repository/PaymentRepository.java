package com.kitolam.rentalroommanagement.modules.payment.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;

import java.util.Optional;

public interface PaymentRepository extends BaseRepository<Payment> {
    Optional<Payment> findByTransactionCodeAndIsDeletedFalse(String transactionCode);
}
