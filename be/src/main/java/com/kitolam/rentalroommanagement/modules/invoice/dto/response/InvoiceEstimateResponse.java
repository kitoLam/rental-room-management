package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Preview of the invoices a month would produce, for slots that have no invoice for it yet.
 * Nothing is stored; rooms whose slots are all invoiced are left out.
 */
public record InvoiceEstimateResponse(
        String branchId,
        String period,
        String currentPeriod,
        int invoicedCount,
        BigDecimal totalAmount,
        List<RoomEstimate> rooms
) {

    public record RoomEstimate(String roomId, String roomNumber, String title, int occupants,
                               BigDecimal totalAmount, List<SlotEstimate> slots) {
    }

    /** One future invoice; the 5 fee totals are given apart for quick reading. */
    public record SlotEstimate(String contractId, String contractNumber, String roomSlotId, String slotCode,
                               String tenantName, LocalDate stayFrom, LocalDate stayTo,
                               BigDecimal rentAmount, BigDecimal roomServiceAmount, BigDecimal personalServiceAmount, BigDecimal electricityAmount,
                               BigDecimal slotServiceAmount, BigDecimal totalAmount, boolean electricityUnchanged,
                               List<String> warnings, List<InvoiceItemResponse> items) {
    }
}
