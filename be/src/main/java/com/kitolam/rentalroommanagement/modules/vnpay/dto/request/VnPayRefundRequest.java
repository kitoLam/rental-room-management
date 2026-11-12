package com.kitolam.rentalroommanagement.modules.vnpay.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Dữ liệu yêu cầu hoàn tiền giao dịch VNPay")
public class VnPayRefundRequest {

    @NotBlank(message = "Mã giao dịch (transactionCode) không được để trống")
    @Schema(description = "Mã giao dịch cần hoàn tiền (trùng với txnRef/transactionCode của Payment)", example = "71829304")
    private String transactionCode;

    @DecimalMin(value = "1000", message = "Số tiền hoàn tối thiểu là 1,000 VNĐ")
    @Schema(description = "Số tiền cần hoàn (VNĐ). Nếu để trống, hệ thống sẽ hoàn toàn bộ số tiền của giao dịch gốc", example = "500000")
    private BigDecimal amount;

    @Schema(description = "Loại hoàn tiền: '02' (Hoàn toàn phần), '03' (Hoàn một phần). Mặc định tự suy luận theo số tiền", example = "02")
    private String refundType;

    @Schema(description = "Lý do hoàn tiền", example = "Khách hàng hủy dịch vụ và yêu cầu hoàn tiền")
    private String orderInfo;
}
