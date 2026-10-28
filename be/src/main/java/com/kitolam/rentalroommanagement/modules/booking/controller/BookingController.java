package com.kitolam.rentalroommanagement.modules.booking.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingPaymentRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingReviewRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingTermsRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.PaymentReconciliationRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingPaymentResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.RoomAvailabilityResponse;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayCreatePaymentRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.service.VnPayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Tag(name = "Bookings")
public class BookingController {

    private final BookingService bookingService;
    private final VnPayService vnPayService;

    @GetMapping("/availability")
    public StandardResponse<RoomAvailabilityResponse> checkAvailability(
            @RequestParam String roomId, @RequestParam java.time.LocalDate startDate,
            @RequestParam java.time.LocalDate endDate) {
        return StandardResponse.success(bookingService.checkAvailability(roomId, startDate, endDate));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo đặt phòng")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<BookingResponse> create(@Valid @RequestBody BookingCreateRequest request,
                                                    @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã gửi yêu cầu đặt phòng", bookingService.create(request, principal));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy đặt phòng theo id")
    public StandardResponse<BookingResponse> getById(@PathVariable String id,
                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.getById(id, principal));
    }

    @GetMapping
    @Operation(summary = "Tìm kiếm / phân trang đặt phòng")
    public StandardResponse<PagedResponse<BookingResponse>> search(
            @Valid @ParameterObject BookingFilterRequest filter,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.search(filter, pageable, principal));
    }

    @PostMapping("/{id}/review")
    @Operation(summary = "Owner/Manager duyệt yêu cầu và xác nhận điều khoản giữ chỗ")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<BookingResponse> review(@PathVariable String id,
                                                    @Valid @RequestBody BookingReviewRequest request,
                                                    @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success("Đã xử lý yêu cầu đặt phòng", bookingService.review(id, request, principal));
    }

    @PostMapping("/{id}/terms")
    @Operation(summary = "Tenant chấp nhận hoặc từ chối điều khoản giữ chỗ")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<BookingResponse> acceptTerms(@PathVariable String id,
                                                         @Valid @RequestBody BookingTermsRequest request,
                                                         @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.acceptTerms(id, request, principal));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Tenant hủy yêu cầu đặt phòng")
    @PreAuthorize("hasAnyRole('TENANT', 'MANAGER', 'OWNER', 'ADMIN')")
    public StandardResponse<BookingResponse> cancel(@PathVariable String id,
                                                    @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.cancel(id, principal));
    }

    @GetMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('TENANT', 'MANAGER', 'OWNER', 'ADMIN')")
    public StandardResponse<java.util.List<BookingPaymentResponse>> payments(
            @PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.payments(id, principal));
    }

    @PostMapping("/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Khởi tạo thanh toán cọc giữ chỗ")
    @PreAuthorize("hasRole('TENANT')")
    public StandardResponse<BookingPaymentResponse> createPayment(
            @PathVariable String id, @Valid @RequestBody BookingPaymentRequest request,
            @AuthenticationPrincipal AuthPrincipal principal, jakarta.servlet.http.HttpServletRequest httpRequest) {
        if (request.method() == PaymentMethod.BANK_TRANSFER)
            return StandardResponse.success(bookingService.createBankTransfer(id, principal));
        if (request.method() != PaymentMethod.VNPAY)
            throw new com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException(
                    "Chỉ hỗ trợ VNPay hoặc chuyển khoản ngân hàng cho cọc giữ chỗ");
        BookingPaymentResponse payment = bookingService.createVnPayPayment(id, principal);
        var paymentUrl = vnPayService.createPaymentUrl(VnPayCreatePaymentRequest.builder()
                .amount(payment.amount())
                .orderInfo("Coc giu cho booking " + id)
                .bookingId(id)
                .transactionCode(payment.transactionCode())
                .build(), httpRequest);
        return StandardResponse.success(new BookingPaymentResponse(payment.id(), id, payment.amount(),
                payment.transactionCode(), payment.method(), payment.status(), payment.createdAt(), payment.paidAt(), paymentUrl.getPaymentUrl()));
    }

    @PostMapping("/{id}/payments/{paymentId}/reconcile")
    @Operation(summary = "Owner/Manager đối soát giao dịch chuyển khoản")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<BookingResponse> reconcilePayment(
            @PathVariable String id, @PathVariable String paymentId,
            @Valid @RequestBody PaymentReconciliationRequest request,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.reconcilePayment(id, paymentId, request, principal));
    }

    @PostMapping("/{id}/refund/approve")
    @Operation(summary = "Owner/Manager duyệt hoàn tiền cọc")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER', 'ADMIN')")
    public StandardResponse<BookingResponse> approveRefund(
            @PathVariable String id, @AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(bookingService.approveRefund(id, principal));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Cập nhật đặt phòng")
    @PreAuthorize("hasRole('ADMIN')")
    public StandardResponse<BookingResponse> update(@PathVariable String id, @Valid @RequestBody BookingUpdateRequest request) {
        return StandardResponse.success("Cập nhật đặt phòng thành công", bookingService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá mềm đặt phòng")
    @PreAuthorize("hasRole('ADMIN')")
    public StandardResponse<Void> delete(@PathVariable String id) {
        bookingService.delete(id);
        return StandardResponse.success("Xoá đặt phòng thành công", null);
    }
}
