package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record BookingPaymentRequest(@NotNull PaymentMethod method) {
}
