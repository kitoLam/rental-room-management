package com.kitolam.rentalroommanagement.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "vnpay")
public class VnPayProperties {
    private String tmnCode;
    private String hashSecret;
    private String url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private String returnUrl = "http://localhost:5173/payment/vnpay-return";
    private String apiUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private String version = "2.1.0";
    private String command = "pay";
    private String currCode = "VND";
    private String locale = "vn";
    private String orderType = "other";
    private int expireMinutes = 15;
}
