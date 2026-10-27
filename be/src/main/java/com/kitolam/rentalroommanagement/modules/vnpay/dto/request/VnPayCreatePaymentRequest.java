package com.kitolam.rentalroommanagement.modules.vnpay.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VnPayCreatePaymentRequest {

    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "5000", message = "Số tiền thanh toán tối thiểu là 5.000 VNĐ")
    @Schema(description = "Số tiền cần thanh toán (VNĐ)", example = "100000")
    private BigDecimal amount;

    @Schema(description = "Nội dung / thông tin đơn hàng", example = "Thanh toán tiền cọc phòng P101")
    private String orderInfo;

    @Schema(description = "Mã hóa đơn liên quan (nếu có)", example = "60c72b2f9b1d8b2bad000001")
    private String invoiceId;

    @Schema(description = "Mã hợp đồng khách thuê (nếu có)", example = "60c72b2f9b1d8b2bad000002")
    private String contractTenantId;

    @Schema(description = "Mã ngân hàng (ví dụ: NCB, VNPAYQR, VISA...). Bỏ trống nếu muốn khách tự chọn trên cổng VNPay", example = "NCB")
    private String bankCode;

    @Schema(description = "URL chuyển hướng sau khi thanh toán xong (tùy chọn, mặc định lấy từ cấu hình hệ thống)")
    private String returnUrl;
}
