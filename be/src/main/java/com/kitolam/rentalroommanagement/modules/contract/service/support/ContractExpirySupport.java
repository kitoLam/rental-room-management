package com.kitolam.rentalroommanagement.modules.contract.service.support;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Quy tắc ngày hết hạn dùng chung cho cảnh báo "sắp hết hạn" (CO1) và thông báo tenant (E).
 * Mọi mốc tính theo ngày Việt Nam, không theo giờ.
 */
public final class ContractExpirySupport {

    public static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Số ngày trước {@code endDate} mà hợp đồng được cảnh báo "Sắp hết hạn". */
    public static final long EXPIRING_SOON_DAYS = 60;

    /** Các mốc gửi thông báo nhắc hết hạn cho tenant (ngày còn lại), giảm dần. */
    public static final int[] EXPIRY_NOTIFY_MILESTONES = {45, 30, 21, 14};

    private ContractExpirySupport() {
    }

    /**
     * Hợp đồng đang hiệu lực và còn ≤ {@link #EXPIRING_SOON_DAYS} ngày tới {@code endDate} (chưa hết hạn).
     */
    public static boolean isExpiringSoon(Contract contract, LocalDate today) {
        if (contract.getStatus() != ContractStatus.ACTIVE || contract.getEndDate() == null) return false;
        LocalDate end = contract.getEndDate();
        return !end.isBefore(today) && !end.isAfter(today.plusDays(EXPIRING_SOON_DAYS));
    }
}
