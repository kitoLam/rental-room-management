package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotNull;

/** Yêu cầu gia hạn hợp đồng: số tháng gia hạn (3, 6, 8 hoặc 12). */
public record ContractRenewRequest(@NotNull Integer termMonths) {
}
