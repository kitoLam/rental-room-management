package com.kitolam.rentalroommanagement.modules.payment.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;

import java.util.Optional;
import java.util.List;

public interface PaymentRepository extends BaseRepository<Payment> {
    Optional<Payment> findByTransactionCodeAndIsDeletedFalse(String transactionCode);

    Optional<Payment> findByIdAndBookingIdAndIsDeletedFalse(String id, String bookingId);

    List<Payment> findByBookingIdAndIsDeletedFalse(String bookingId);
}
