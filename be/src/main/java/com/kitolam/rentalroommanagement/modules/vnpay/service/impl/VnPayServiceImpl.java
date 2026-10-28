package com.kitolam.rentalroommanagement.modules.vnpay.service.impl;

import com.kitolam.rentalroommanagement.common.config.VnPayProperties;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.VnPayUtil;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayCreatePaymentRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.request.VnPayRefundRequest;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayCreatePaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayIpnResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayPaymentResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.dto.response.VnPayRefundResponse;
import com.kitolam.rentalroommanagement.modules.vnpay.service.VnPayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VnPayServiceImpl implements VnPayService {

    private final VnPayProperties properties;
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final BookingService bookingService;
    private final ObjectMapper objectMapper;

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VNPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Override
    @Transactional
    public VnPayCreatePaymentResponse createPaymentUrl(VnPayCreatePaymentRequest request, HttpServletRequest httpRequest) {
        String txnRef = request.getTransactionCode() == null || request.getTransactionCode().isBlank()
                ? VnPayUtil.getRandomNumber(8) : request.getTransactionCode();
        String clientIp = VnPayUtil.getIpAddress(httpRequest);

        // Lưu bản ghi Payment trạng thái PENDING
        Payment payment = paymentRepository.findByTransactionCodeAndIsDeletedFalse(txnRef).orElse(null);
        if (payment == null) {
            payment = new Payment();
            payment.setTransactionCode(txnRef);
            payment.setAmount(request.getAmount());
            payment.setInvoiceId(request.getInvoiceId());
            payment.setContractTenantId(request.getContractTenantId());
            payment.setBookingId(request.getBookingId());
            payment.setMethod(PaymentMethod.VNPAY);
            payment.setStatus(PaymentStatus.PENDING);
            paymentRepository.save(payment);
        } else if (!PaymentMethod.VNPAY.equals(payment.getMethod())
                || !request.getAmount().equals(payment.getAmount())
                || (request.getBookingId() != null && !request.getBookingId().equals(payment.getBookingId()))) {
            throw new IllegalArgumentException("Thông tin giao dịch VNPay không khớp booking đã tạo");
        }

        ZonedDateTime now = ZonedDateTime.now(VIETNAM_ZONE);
        String vnpCreateDate = now.format(VNPAY_DATE_FORMAT);
        String vnpExpireDate = now.plusMinutes(properties.getExpireMinutes()).format(VNPAY_DATE_FORMAT);

        // VNPay quy định số tiền phải nhân với 100 (đổi ra xu/hào, không có phần thập phân)
        long amountCents = request.getAmount().multiply(BigDecimal.valueOf(100)).longValue();

        String orderInfo = request.getOrderInfo();
        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan don hang " + txnRef;
        }

        String returnUrl = request.getReturnUrl();
        if (returnUrl == null || returnUrl.isBlank()) {
            returnUrl = properties.getReturnUrl();
        }

        Map<String, String> vnpParams = new HashMap<>();
        vnpParams.put("vnp_Version", properties.getVersion());
        vnpParams.put("vnp_Command", properties.getCommand());
        vnpParams.put("vnp_TmnCode", properties.getTmnCode());
        vnpParams.put("vnp_Amount", String.valueOf(amountCents));
        vnpParams.put("vnp_CurrCode", properties.getCurrCode());
        vnpParams.put("vnp_TxnRef", txnRef);
        vnpParams.put("vnp_OrderInfo", orderInfo);
        vnpParams.put("vnp_OrderType", properties.getOrderType());
        vnpParams.put("vnp_Locale", properties.getLocale());
        vnpParams.put("vnp_ReturnUrl", returnUrl);
        vnpParams.put("vnp_IpAddr", clientIp);
        vnpParams.put("vnp_CreateDate", vnpCreateDate);
        vnpParams.put("vnp_ExpireDate", vnpExpireDate);

        if (request.getBankCode() != null && !request.getBankCode().isBlank()) {
            vnpParams.put("vnp_BankCode", request.getBankCode());
        }

        String hashData = VnPayUtil.buildHashData(vnpParams);
        String queryUrl = VnPayUtil.buildQueryUrl(vnpParams);
        String vnpSecureHash = VnPayUtil.hmacSHA512(properties.getHashSecret(), hashData);
        String paymentUrl = properties.getUrl() + "?" + queryUrl + "&vnp_SecureHash=" + vnpSecureHash;

        log.info("Khởi tạo giao dịch VNPay thành công: txnRef={}, amount={}", txnRef, request.getAmount());

        return VnPayCreatePaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionCode(txnRef)
                .amount(request.getAmount())
                .orderInfo(orderInfo)
                .build();
    }

    @Override
    @Transactional
    public VnPayPaymentResponse processReturn(Map<String, String> queryParams) {
        String vnpSecureHash = queryParams.get("vnp_SecureHash");
        Map<String, String> cleanParams = filterVnPayParams(queryParams);

        String hashData = VnPayUtil.buildHashData(cleanParams);
        String expectedHash = VnPayUtil.hmacSHA512(properties.getHashSecret(), hashData);
        boolean validSignature = expectedHash.equalsIgnoreCase(vnpSecureHash);

        String txnRef = queryParams.get("vnp_TxnRef");
        String responseCode = queryParams.get("vnp_ResponseCode");
        String transactionStatus = queryParams.get("vnp_TransactionStatus");
        String bankCode = queryParams.get("vnp_BankCode");
        String bankTranNo = queryParams.get("vnp_BankTranNo");
        String cardType = queryParams.get("vnp_CardType");
        String orderInfo = queryParams.get("vnp_OrderInfo");
        String payDate = queryParams.get("vnp_PayDate");
        String transactionNo = queryParams.get("vnp_TransactionNo");

        BigDecimal amount = BigDecimal.ZERO;
        String rawAmount = queryParams.get("vnp_Amount");
        if (rawAmount != null && !rawAmount.isBlank()) {
            amount = new BigDecimal(rawAmount).divide(BigDecimal.valueOf(100));
        }
        BigDecimal verifiedAmount = amount;

        if (!validSignature) {
            log.warn("VNPay Return: Chữ ký không hợp lệ! txnRef={}", txnRef);
            return VnPayPaymentResponse.builder()
                    .validSignature(false)
                    .transactionCode(txnRef)
                    .amount(amount)
                    .bankCode(bankCode)
                    .responseCode(responseCode)
                    .transactionStatus(transactionStatus)
                    .status("INVALID_SIGNATURE")
                    .message("Chữ ký phản hồi từ VNPay không hợp lệ (Sai checksum)")
                    .build();
        }

        boolean isSuccess = "00".equals(responseCode) && "00".equals(transactionStatus);
        String status = isSuccess ? "SUCCESS" : "FAILED";
        String message = getResponseMessage(responseCode);

        // Cập nhật trạng thái Payment trong Database nếu đang PENDING
        paymentRepository.findByTransactionCodeAndIsDeletedFalse(txnRef).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.PENDING) {
                if (payment.getAmount().compareTo(verifiedAmount) != 0) return;
                if (isSuccess) {
                    payment.setStatus(PaymentStatus.SUCCESS);
                    payment.setPaidAt(Instant.now());
                    if (transactionNo != null && !transactionNo.isBlank()) {
                        payment.setGatewayTransactionNo(transactionNo);
                    }
                    updateInvoiceIfPresent(payment);
                } else {
                    payment.setStatus(PaymentStatus.FAILED);
                }
                paymentRepository.save(payment);
                if (payment.getBookingId() != null) bookingService.processPaymentResult(payment.getBookingId(), isSuccess);
                log.info("VNPay Return: Cập nhật Payment [{}] -> {}", txnRef, payment.getStatus());
            }
        });

        return VnPayPaymentResponse.builder()
                .validSignature(true)
                .transactionCode(txnRef)
                .amount(amount)
                .bankCode(bankCode)
                .bankTranNo(bankTranNo)
                .cardType(cardType)
                .orderInfo(orderInfo)
                .payDate(payDate)
                .responseCode(responseCode)
                .transactionNo(transactionNo)
                .transactionStatus(transactionStatus)
                .status(status)
                .message(message)
                .build();
    }

    @Override
    @Transactional
    public VnPayIpnResponse processIpn(Map<String, String> queryParams) {
        String vnpSecureHash = queryParams.get("vnp_SecureHash");
        Map<String, String> cleanParams = filterVnPayParams(queryParams);

        String hashData = VnPayUtil.buildHashData(cleanParams);
        String expectedHash = VnPayUtil.hmacSHA512(properties.getHashSecret(), hashData);

        // 1. Kiểm tra chữ ký (Check Checksum)
        if (!expectedHash.equalsIgnoreCase(vnpSecureHash)) {
            log.warn("VNPay IPN: Chữ ký không hợp lệ! expected={}, received={}", expectedHash, vnpSecureHash);
            return VnPayIpnResponse.invalidChecksum();
        }

        String txnRef = queryParams.get("vnp_TxnRef");
        var paymentOpt = paymentRepository.findByTransactionCodeAndIsDeletedFalse(txnRef);

        // 2. Kiểm tra đơn hàng tồn tại (Check Order exists)
        if (paymentOpt.isEmpty()) {
            log.warn("VNPay IPN: Không tìm thấy giao dịch với txnRef={}", txnRef);
            return VnPayIpnResponse.orderNotFound();
        }

        Payment payment = paymentOpt.get();

        // 3. Kiểm tra số tiền (Check Amount)
        try {
            long vnpAmount = Long.parseLong(queryParams.get("vnp_Amount")) / 100;
            if (payment.getAmount().longValue() != vnpAmount) {
                log.warn("VNPay IPN: Sai lệch số tiền! DB={}, VNPay={}", payment.getAmount(), vnpAmount);
                return VnPayIpnResponse.invalidAmount();
            }
        } catch (Exception ex) {
            return VnPayIpnResponse.invalidAmount();
        }

        // 4. Kiểm tra trạng thái đơn hàng (Check Order Status - tránh update trùng lặp)
        if (payment.getStatus() != PaymentStatus.PENDING) {
            log.info("VNPay IPN: Giao dịch [{}] đã được xử lý trước đó, trạng thái={}", txnRef, payment.getStatus());
            return VnPayIpnResponse.orderAlreadyConfirmed();
        }

        // 5. Cập nhật trạng thái đơn hàng
        String responseCode = queryParams.get("vnp_ResponseCode");
        String transactionStatus = queryParams.get("vnp_TransactionStatus");
        boolean isSuccess = "00".equals(responseCode) && ("00".equals(transactionStatus) || transactionStatus == null);

        if (isSuccess) {
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaidAt(Instant.now());
            String transactionNo = queryParams.get("vnp_TransactionNo");
            if (transactionNo != null && !transactionNo.isBlank()) {
                payment.setGatewayTransactionNo(transactionNo);
            }
            updateInvoiceIfPresent(payment);
            log.info("VNPay IPN: Giao dịch [{}] thanh toán THÀNH CÔNG", txnRef);
        } else {
            payment.setStatus(PaymentStatus.FAILED);
            log.warn("VNPay IPN: Giao dịch [{}] THẤT BẠI, responseCode={}", txnRef, responseCode);
        }

        paymentRepository.save(payment);
        if (payment.getBookingId() != null) bookingService.processPaymentResult(payment.getBookingId(), isSuccess);
        return VnPayIpnResponse.success();
    }

    @Override
    @Transactional
    public VnPayRefundResponse refund(VnPayRefundRequest request, HttpServletRequest httpRequest) {
        String txnRef = request.getTransactionCode();
        Payment payment = paymentRepository.findByTransactionCodeAndIsDeletedFalse(txnRef)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy giao dịch thanh toán với mã: " + txnRef));

        if (!PaymentMethod.VNPAY.equals(payment.getMethod())) {
            throw new BadRequestException("Giao dịch không phải thanh toán qua VNPay");
        }
        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            throw new ConflictException("Giao dịch này đã được hoàn tiền trước đó");
        }
        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new BadRequestException("Chỉ có thể hoàn tiền cho giao dịch đã thanh toán THÀNH CÔNG (Trạng thái hiện tại: " + payment.getStatus() + ")");
        }

        BigDecimal refundAmount = request.getAmount() != null ? request.getAmount() : payment.getAmount();
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0 || refundAmount.compareTo(payment.getAmount()) > 0) {
            throw new BadRequestException("Số tiền hoàn không hợp lệ (Phải từ 1,000 VNĐ đến tối đa " + payment.getAmount() + " VNĐ)");
        }

        String refundType = request.getRefundType();
        if (refundType == null || (!"02".equals(refundType) && !"03".equals(refundType))) {
            refundType = refundAmount.compareTo(payment.getAmount()) == 0 ? "02" : "03";
        }

        ZonedDateTime now = ZonedDateTime.now(VIETNAM_ZONE);
        String vnpRequestId = VnPayUtil.getRandomNumber(8);
        String vnpCreateDate = now.format(VNPAY_DATE_FORMAT);
        String clientIp = VnPayUtil.getIpAddress(httpRequest);

        String orderInfo = request.getOrderInfo();
        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Hoan tien giao dich " + txnRef;
        }

        // Chế độ mô phỏng Sandbox (khi cấu hình bật flag hoặc không có TMN Code thật)
        if (properties.isRefundSimulationEnabled() || properties.getTmnCode() == null || properties.getTmnCode().isBlank()) {
            log.info("VNPay Refund: Đang chạy chế độ mô phỏng sandbox. TxnRef={}, Amount={}", txnRef, refundAmount);
            payment.setStatus(PaymentStatus.REFUNDED);
            paymentRepository.save(payment);

            return VnPayRefundResponse.builder()
                    .requestId(vnpRequestId)
                    .responseCode("00")
                    .message("Hoàn tiền thành công (Mô phỏng Sandbox)")
                    .transactionCode(txnRef)
                    .amount(refundAmount)
                    .transactionNo("SIM-" + VnPayUtil.getRandomNumber(8))
                    .refundType(refundType)
                    .transactionStatus("00")
                    .payDate(vnpCreateDate)
                    .refundedAt(Instant.now().toString())
                    .success(true)
                    .build();
        }

        // Gọi API VNPay thật
        String vnpTransactionNo = payment.getGatewayTransactionNo() != null && !payment.getGatewayTransactionNo().isBlank()
                ? payment.getGatewayTransactionNo() : "0";
        Instant paidAt = payment.getPaidAt() != null ? payment.getPaidAt() : payment.getCreatedAt();
        String vnpTransactionDate = paidAt != null
                ? ZonedDateTime.ofInstant(paidAt, VIETNAM_ZONE).format(VNPAY_DATE_FORMAT)
                : vnpCreateDate;

        long amountCents = refundAmount.multiply(BigDecimal.valueOf(100)).longValue();
        String vnpCreateBy = "SystemAdmin";

        String hashData = VnPayUtil.buildRefundHashData(
                vnpRequestId,
                properties.getVersion(),
                "refund",
                properties.getTmnCode(),
                refundType,
                txnRef,
                String.valueOf(amountCents),
                vnpTransactionNo,
                vnpTransactionDate,
                vnpCreateBy,
                vnpCreateDate,
                clientIp,
                orderInfo
        );
        String vnpSecureHash = VnPayUtil.hmacSHA512(properties.getHashSecret(), hashData);

        Map<String, Object> requestPayload = new HashMap<>();
        requestPayload.put("vnp_RequestId", vnpRequestId);
        requestPayload.put("vnp_Version", properties.getVersion());
        requestPayload.put("vnp_Command", "refund");
        requestPayload.put("vnp_TmnCode", properties.getTmnCode());
        requestPayload.put("vnp_TransactionType", refundType);
        requestPayload.put("vnp_TxnRef", txnRef);
        requestPayload.put("vnp_Amount", amountCents);
        requestPayload.put("vnp_OrderInfo", orderInfo);
        requestPayload.put("vnp_TransactionNo", Long.parseLong(vnpTransactionNo.matches("\\d+") ? vnpTransactionNo : "0"));
        requestPayload.put("vnp_TransactionDate", vnpTransactionDate);
        requestPayload.put("vnp_CreateBy", vnpCreateBy);
        requestPayload.put("vnp_CreateDate", vnpCreateDate);
        requestPayload.put("vnp_IpAddr", clientIp);
        requestPayload.put("vnp_SecureHash", vnpSecureHash);

        try {
            String jsonBody = objectMapper.writeValueAsString(requestPayload);
            log.info("VNPay Refund Request: Url={}, Payload={}", properties.getApiUrl(), jsonBody);

            HttpRequest apiRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getApiUrl()))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> apiResponse = httpClient.send(apiRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            log.info("VNPay Refund Response: Status={}, Body={}", apiResponse.statusCode(), apiResponse.body());

            @SuppressWarnings("unchecked")
            Map<String, Object> respMap = (Map<String, Object>) objectMapper.readValue(apiResponse.body(), Map.class);
            String responseCode = respMap.get("vnp_ResponseCode") != null ? respMap.get("vnp_ResponseCode").toString() : "99";
            String transactionStatus = respMap.get("vnp_TransactionStatus") != null ? respMap.get("vnp_TransactionStatus").toString() : "";
            String message = getRefundResponseMessage(responseCode);
            String vnpPayDate = respMap.get("vnp_PayDate") != null ? respMap.get("vnp_PayDate").toString() : vnpCreateDate;
            String respTransactionNo = respMap.get("vnp_TransactionNo") != null ? respMap.get("vnp_TransactionNo").toString() : vnpTransactionNo;

            boolean isSuccess = "00".equals(responseCode);
            if (isSuccess) {
                payment.setStatus(PaymentStatus.REFUNDED);
                paymentRepository.save(payment);
                log.info("VNPay Refund: Hoàn tiền thành công cho giao dịch [{}]", txnRef);
            } else {
                log.warn("VNPay Refund: Hoàn tiền thất bại cho giao dịch [{}], code={}, msg={}", txnRef, responseCode, message);
            }

            return VnPayRefundResponse.builder()
                    .requestId(vnpRequestId)
                    .responseCode(responseCode)
                    .message(message)
                    .transactionCode(txnRef)
                    .amount(refundAmount)
                    .transactionNo(respTransactionNo)
                    .refundType(refundType)
                    .transactionStatus(transactionStatus)
                    .payDate(vnpPayDate)
                    .refundedAt(isSuccess ? Instant.now().toString() : null)
                    .success(isSuccess)
                    .build();

        } catch (Exception ex) {
            log.error("Lỗi khi kết nối gọi API hoàn tiền VNPay: txnRef={}", txnRef, ex);
            throw new BadRequestException("Không thể kết nối đến cổng thanh toán VNPay để xử lý hoàn tiền: " + ex.getMessage());
        }
    }

    private Map<String, String> filterVnPayParams(Map<String, String> queryParams) {
        Map<String, String> cleanParams = new HashMap<>();
        for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key != null && key.startsWith("vnp_") && !key.equals("vnp_SecureHash") && !key.equals("vnp_SecureHashType")
                    && value != null && !value.isEmpty()) {
                cleanParams.put(key, value);
            }
        }
        return cleanParams;
    }

    private void updateInvoiceIfPresent(Payment payment) {
        if (payment.getInvoiceId() != null && !payment.getInvoiceId().isBlank()) {
            invoiceRepository.findByIdAndIsDeletedFalse(payment.getInvoiceId()).ifPresent(invoice -> {
                BigDecimal currentPaid = invoice.getPaidAmount() != null ? invoice.getPaidAmount() : BigDecimal.ZERO;
                BigDecimal newPaid = currentPaid.add(payment.getAmount());
                invoice.setPaidAmount(newPaid);

                BigDecimal total = invoice.getTotalAmount() != null ? invoice.getTotalAmount() : BigDecimal.ZERO;
                BigDecimal remaining = total.subtract(newPaid);
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                    invoice.setRemainingAmount(BigDecimal.ZERO);
                    invoice.setStatus(InvoiceStatus.PAID);
                } else {
                    invoice.setRemainingAmount(remaining);
                    invoice.setStatus(InvoiceStatus.PARTIALLY_PAID);
                }
                invoiceRepository.save(invoice);
                log.info("Cập nhật hóa đơn [{}] sau thanh toán VNPay: status={}, paid={}, remaining={}",
                        invoice.getId(), invoice.getStatus(), invoice.getPaidAmount(), invoice.getRemainingAmount());
            });
        }
    }

    private String getResponseMessage(String responseCode) {
        if (responseCode == null) return "Không xác định";
        return switch (responseCode) {
            case "00" -> "Giao dịch thành công";
            case "07" -> "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)";
            case "09" -> "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking";
            case "10" -> "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần";
            case "11" -> "Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch";
            case "12" -> "Thẻ/Tài khoản của khách hàng bị khóa";
            case "13" -> "Nhập sai mật khẩu xác thực giao dịch (OTP)";
            case "24" -> "Khách hàng hủy giao dịch";
            case "51" -> "Tài khoản của quý khách không đủ số dư để thực hiện giao dịch";
            case "65" -> "Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày";
            case "75" -> "Ngân hàng thanh toán đang bảo trì";
            case "79" -> "Nhập sai mật khẩu thanh toán quá số lần quy định";
            case "99" -> "Lỗi không xác định từ hệ thống";
            default -> "Giao dịch thất bại (Mã lỗi: " + responseCode + ")";
        };
    }

    private String getRefundResponseMessage(String responseCode) {
        if (responseCode == null) return "Không xác định";
        return switch (responseCode) {
            case "00" -> "Hoàn tiền giao dịch thành công";
            case "02" -> "Tổng số tiền hoàn lớn hơn số tiền giao dịch gốc";
            case "03" -> "Dữ liệu gửi sang VNPay không đúng định dạng";
            case "04" -> "Không cho phép hoàn tiền do giao dịch đã được hoàn trả trước đó";
            case "13" -> "Giao dịch không thành công tại VNPAY, không thể thực hiện hoàn tiền";
            case "91" -> "Không tìm thấy giao dịch yêu cầu hoàn tiền tại VNPAY";
            case "93" -> "Số tiền hoàn không hợp lệ (số tiền hoàn phải nhỏ hơn hoặc bằng số tiền thanh toán)";
            case "94" -> "Yêu cầu bị trùng lặp trong thời gian giới hạn xử lý";
            case "95" -> "Giao dịch này không thành công bên VNPAY, không hoàn trả được";
            case "97" -> "Chữ ký không hợp lệ (Sai checksum)";
            case "98" -> "Timeout: Không nhận được phản hồi từ ngân hàng hoặc VNPay";
            case "99" -> "Lỗi không xác định từ hệ thống VNPay";
            default -> "Hoàn tiền thất bại (Mã phản hồi VNPay: " + responseCode + ")";
        };
    }
}
