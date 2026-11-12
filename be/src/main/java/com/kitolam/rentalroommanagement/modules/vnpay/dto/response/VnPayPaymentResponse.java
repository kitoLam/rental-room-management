package com.kitolam.rentalroommanagement.modules.vnpay.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VnPayPaymentResponse {
    private boolean validSignature;
    private String transactionCode;
    private BigDecimal amount;
    private String bankCode;
    private String bankTranNo;
    private String cardType;
    private String orderInfo;
    private String payDate;
    private String responseCode;
    private String transactionNo;
    private String transactionStatus;
    private String status; // SUCCESS, FAILED, INVALID_SIGNATURE
    private String message;
}
