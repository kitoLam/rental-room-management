package com.kitolam.rentalroommanagement.common.util;

import jakarta.servlet.http.HttpServletRequest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class VnPayUtil {

    private static final SecureRandom RANDOM = new SecureRandom();

    public static String hmacSHA512(final String key, final String data) {
        try {
            if (key == null || data == null) {
                return "";
            }
            final Mac hmac512 = Mac.getInstance("HmacSHA512");
            byte[] hmacKeyBytes = key.trim().getBytes(StandardCharsets.UTF_8);
            final SecretKeySpec secretKey = new SecretKeySpec(hmacKeyBytes, "HmacSHA512");
            hmac512.init(secretKey);
            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
            byte[] result = hmac512.doFinal(dataBytes);
            StringBuilder sb = new StringBuilder(2 * result.length);
            for (byte b : result) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ex) {
            return "";
        }
    }

    public static String getIpAddress(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("HTTP_CLIENT_IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getRemoteAddr();
        }
        if (ipAddress != null && ipAddress.contains(",")) {
            ipAddress = ipAddress.split(",")[0].trim();
        }
        if ("0:0:0:0:0:0:0:1".equals(ipAddress) || "localhost".equalsIgnoreCase(ipAddress)) {
            ipAddress = "127.0.0.1";
        }
        return ipAddress != null ? ipAddress : "127.0.0.1";
    }

    public static String getRandomNumber(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    /**
     * Sắp xếp các tham số theo thứ tự a-z, mã hóa URL US-ASCII và nối thành chuỗi hash data theo chuẩn VNPay.
     */
    public static String buildHashData(Map<String, String> fields) {
        List<String> fieldNames = new ArrayList<>(fields.keySet());
        Collections.sort(fieldNames);
        StringBuilder sb = new StringBuilder();
        for (String fieldName : fieldNames) {
            String fieldValue = fields.get(fieldName);
            if (fieldValue != null && !fieldValue.isEmpty()) {
                if (!sb.isEmpty()) {
                    sb.append('&');
                }
                sb.append(fieldName);
                sb.append('=');
                sb.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));
            }
        }
        return sb.toString();
    }

    /**
     * Nối các tham số thành chuỗi query url chuẩn VNPay (US-ASCII URL encoded).
     */
    public static String buildQueryUrl(Map<String, String> fields) {
        List<String> fieldNames = new ArrayList<>(fields.keySet());
        Collections.sort(fieldNames);
        StringBuilder sb = new StringBuilder();
        for (String fieldName : fieldNames) {
            String fieldValue = fields.get(fieldName);
            if (fieldValue != null && !fieldValue.isEmpty()) {
                if (!sb.isEmpty()) {
                    sb.append('&');
                }
                sb.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII));
                sb.append('=');
                sb.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));
            }
        }
        return sb.toString();
    }

    /**
     * Ghép chuỗi hash data phục vụ tạo chữ ký API hoàn tiền (vnp_Command = refund) theo chuẩn VNPAY 2.1.0:
     * vnp_RequestId|vnp_Version|vnp_Command|vnp_TmnCode|vnp_TransactionType|vnp_TxnRef|vnp_Amount|vnp_TransactionNo|vnp_TransactionDate|vnp_CreateBy|vnp_CreateDate|vnp_IpAddr|vnp_OrderInfo
     */
    public static String buildRefundHashData(
            String requestId,
            String version,
            String command,
            String tmnCode,
            String transactionType,
            String txnRef,
            String amount,
            String transactionNo,
            String transactionDate,
            String createBy,
            String createDate,
            String ipAddr,
            String orderInfo
    ) {
        return String.join("|",
                requestId != null ? requestId : "",
                version != null ? version : "",
                command != null ? command : "",
                tmnCode != null ? tmnCode : "",
                transactionType != null ? transactionType : "",
                txnRef != null ? txnRef : "",
                amount != null ? amount : "",
                transactionNo != null && !transactionNo.isBlank() ? transactionNo : "0",
                transactionDate != null ? transactionDate : "",
                createBy != null ? createBy : "",
                createDate != null ? createDate : "",
                ipAddr != null ? ipAddr : "",
                orderInfo != null ? orderInfo : ""
        );
    }
}