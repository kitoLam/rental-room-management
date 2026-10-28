package com.kitolam.rentalroommanagement.modules.booking.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingReviewRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingTermsRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.PaymentReconciliationRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingPaymentResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.EffectiveRoomHoldResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.RoomAvailabilityResponse;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface BookingService {
    EffectiveRoomHoldResponse currentRoomHold(String roomId);

    BookingResponse create(BookingCreateRequest request, AuthPrincipal principal);

    RoomAvailabilityResponse checkAvailability(String roomId, java.time.LocalDate startDate, java.time.LocalDate endDate);

    BookingResponse getById(String id, AuthPrincipal principal);

    PagedResponse<BookingResponse> search(BookingFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    BookingResponse review(String id, BookingReviewRequest request, AuthPrincipal principal);

    BookingResponse acceptTerms(String id, BookingTermsRequest request, AuthPrincipal principal);

    BookingResponse cancel(String id, AuthPrincipal principal);

    BookingPaymentResponse createBankTransfer(String id, AuthPrincipal principal);

    BookingPaymentResponse createVnPayPayment(String id, AuthPrincipal principal);

    List<BookingPaymentResponse> payments(String id, AuthPrincipal principal);

    BookingResponse reconcilePayment(String id, String paymentId, PaymentReconciliationRequest request, AuthPrincipal principal);

    BookingResponse processPaymentResult(String id, boolean successful);

    BookingResponse approveRefund(String id, AuthPrincipal principal);

    BookingResponse update(String id, BookingUpdateRequest request);

    void delete(String id);
}
