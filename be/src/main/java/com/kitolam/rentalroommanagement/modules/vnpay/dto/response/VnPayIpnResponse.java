package com.kitolam.rentalroommanagement.modules.vnpay.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VnPayIpnResponse {

    @JsonProperty("RspCode")
    private String rspCode;

    @JsonProperty("Message")
    private String message;

    public static VnPayIpnResponse success() {
        return new VnPayIpnResponse("00", "Confirm Success");
    }

    public static VnPayIpnResponse orderNotFound() {
        return new VnPayIpnResponse("01", "Order not Found");
    }

    public static VnPayIpnResponse orderAlreadyConfirmed() {
        return new VnPayIpnResponse("02", "Order already confirmed");
    }

    public static VnPayIpnResponse invalidAmount() {
        return new VnPayIpnResponse("04", "Invalid Amount");
    }

    public static VnPayIpnResponse invalidChecksum() {
        return new VnPayIpnResponse("97", "Invalid Checksum");
    }

    public static VnPayIpnResponse unknownError() {
        return new VnPayIpnResponse("99", "Unknown error");
    }
}
