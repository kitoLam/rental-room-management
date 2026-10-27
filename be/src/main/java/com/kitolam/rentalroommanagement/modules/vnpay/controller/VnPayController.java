package com.kitolam.rentalroommanagement.modules.vnpay.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayCreatePaymentRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayCreatePaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayIpnResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayPaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.service.VnPayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/vnpay")
@RequiredArgsConstructor
@Tag(name = "VNPay Payment Gateway", description = "Các API thanh toán tích hợp VNPay Sandbox")
public class VnPayController {

    private final VnPayService vnPayService;

    @PostMapping("/create-payment")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Tạo URL thanh toán VNPay", description = "Tạo liên kết thanh toán VNPay và lưu thông tin giao dịch khởi tạo")
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
}
