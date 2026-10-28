package com.kitolam.rentalroommanagement.modules.vnpay.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayCreatePaymentRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayRefundRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayCreatePaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayIpnResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayPaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayRefundResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.service.VnPayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/vnpay")
@RequiredArgsConstructor
@Tag(name = "VNPay Payment Gateway", description = "Các API thanh toán và hoàn tiền tích hợp VNPay")
public class VnPayController {

    private final VnPayService vnPayService;

    @PostMapping("/create-payment")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo URL thanh toán VNPay", description = "Tạo liên kết thanh toán VNPay và lưu thông tin giao dịch khởi tạo")
    @PreAuthorize("isAuthenticated()")
    public StandardResponse<VnPayCreatePaymentResponse> createPayment(
            @Valid @RequestBody VnPayCreatePaymentRequest request,
            HttpServletRequest httpRequest) {
        return StandardResponse.success("Tạo URL thanh toán VNPay thành công", vnPayService.createPaymentUrl(request, httpRequest));
    }

    @GetMapping("/return")
    @Operation(summary = "Xử lý kết quả trả về từ VNPay (ReturnUrl)", description = "Kiểm tra chữ ký và hiển thị kết quả giao dịch sau khi khách hàng thanh toán xong")
    public StandardResponse<VnPayPaymentResponse> processReturn(@RequestParam Map<String, String> queryParams) {
        return StandardResponse.success(vnPayService.processReturn(queryParams));
    }

    @GetMapping("/ipn")
    @Operation(summary = "Xử lý thông báo tức thời từ máy chủ VNPay (IPN)", description = "VNPay gọi endpoint này ngầm để xác thực giao dịch và cập nhật trạng thái đơn hàng")
    public VnPayIpnResponse processIpn(@RequestParam Map<String, String> queryParams) {
        return vnPayService.processIpn(queryParams);
    }

    @PostMapping("/refund")
    @Operation(summary = "Hoàn tiền giao dịch VNPay (Refund)", description = "Gửi yêu cầu hoàn tiền toàn phần hoặc một phần qua cổng thanh toán VNPay")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'OWNER')")
    public StandardResponse<VnPayRefundResponse> refund(
            @Valid @RequestBody VnPayRefundRequest request,
            HttpServletRequest httpRequest) {
        return StandardResponse.success("Xử lý yêu cầu hoàn tiền VNPay thành công", vnPayService.refund(request, httpRequest));
    }
}
