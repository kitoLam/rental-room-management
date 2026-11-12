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
public class VnPayCreatePaymentResponse {
    private String paymentUrl;
    private String transactionCode;
    private BigDecimal amount;
    private String orderInfo;
}
