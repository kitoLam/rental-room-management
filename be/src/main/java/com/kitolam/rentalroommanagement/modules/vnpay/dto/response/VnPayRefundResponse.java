package com.kitolam.rentalroommanagement.modules.vnpay.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả phản hồi hoàn tiền từ cổng thanh toán VNPay")
public class VnPayRefundResponse {

    @Schema(description = "Mã yêu cầu hoàn tiền (RequestId do hệ thống sinh ra)", example = "RF_1698547200000_1234")
    private String requestId;

    @Schema(description = "Mã phản hồi từ VNPay ('00' là thành công)", example = "00")
    private String responseCode;

    @Schema(description = "Thông điệp phản hồi từ hệ thống", example = "Giao dịch thành công")
    private String message;

    @Schema(description = "Mã giao dịch merchant (transactionCode)", example = "71829304")
    private String transactionCode;

    @Schema(description = "Số tiền hoàn tiền", example = "500000")
    private BigDecimal amount;

    @Schema(description = "Mã giao dịch ghi nhận tại hệ thống VNPay", example = "14422574")
    private String transactionNo;

    @Schema(description = "Loại hoàn tiền ('02': Toàn phần, '03': Một phần)", example = "02")
    private String refundType;

    @Schema(description = "Trạng thái giao dịch hoàn tiền phía VNPay ('00': Thành công)", example = "00")
    private String transactionStatus;

    @Schema(description = "Thời gian phản hồi giao dịch từ VNPay", example = "20261029123000")
    private String payDate;

    @Schema(description = "Thời gian xử lý hoàn tiền tại hệ thống", example = "2026-10-29T12:30:00Z")
    private String refundedAt;

    @Schema(description = "Trạng thái hoàn tiền (true nếu thành công)", example = "true")
    private boolean success;
}
