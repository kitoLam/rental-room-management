package com.kitolam.rentalroommanagement.modules.meterreading.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.request.MeterReadingSaveRequest;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterBoardResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.MeterReadingResponse;

public interface MeterReadingService {

    MeterBoardResponse board(String branchId, String period, AuthPrincipal principal);

    /** Create or update the DRAFT reading of a room / month. */
    MeterReadingResponse save(MeterReadingSaveRequest request, AuthPrincipal principal);

    /** DRAFT -> CONFIRMED. */
    MeterReadingResponse confirm(String id, AuthPrincipal principal);

    /** CONFIRMED -> DRAFT, only while the next month has no reading yet. */
    MeterReadingResponse reopen(String id, AuthPrincipal principal);
}
