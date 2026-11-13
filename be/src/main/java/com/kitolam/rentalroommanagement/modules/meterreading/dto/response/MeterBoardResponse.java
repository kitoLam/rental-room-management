package com.kitolam.rentalroommanagement.modules.meterreading.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Electricity board of a branch for one month: the current rate and one row per room.
 *
 * @param currentPeriod   the current month (Vietnam time); only this month can be edited
 * @param editable        period == currentPeriod
 * @param electricityRate branch electricity rate (VND / kWh); null when not configured yet
 */
public record MeterBoardResponse(
        String branchId,
        String period,
        String currentPeriod,
        boolean editable,
        BigDecimal electricityRate,
        List<Row> rooms
) {

    /**
     * @param suggestedStartReading previous month's end reading (used when the room has no reading this month)
     * @param reading               this month's reading, null if not entered yet
     */
    public record Row(String roomId, String roomNumber, String title, BigDecimal suggestedStartReading,
                      MeterReadingResponse reading) {
    }
}
