package com.kitolam.rentalroommanagement.modules.vnpay.service;

import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayCreatePaymentRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayCreatePaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayIpnResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayPaymentResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

public interface VnPayService {
    VnPayCreatePaymentResponse createPaymentUrl(VnPayCreatePaymentRequest request, HttpServletRequest httpRequest);
    VnPayPaymentResponse processReturn(Map<String, String> queryParams);
    VnPayIpnResponse processIpn(Map<String, String> queryParams);
}
