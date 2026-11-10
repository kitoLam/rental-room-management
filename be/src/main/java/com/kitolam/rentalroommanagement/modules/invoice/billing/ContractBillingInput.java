package com.kitolam.rentalroommanagement.modules.invoice.billing;

import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Everything needed to bill one contract for one period, already loaded from the database.
 * All ranges are clipped to the period and to the contract's billing window.
 *
 * @param billingWindow days the contract is billed in this period (empty = nothing to bill)
 * @param holdings      slots held by the contract
 * @param slotServices  services subscribed on those slots
 * @param roomServices  services of every room the contract holds a slot in
 * @param roomSlotDays  roomId -> (contractId -> slot-days) for every contract living in the room; used to split room charges
 */
public record ContractBillingInput(
        String contractId,
        BigDecimal rentPrice,
        DateRange billingWindow,
        List<Holding> holdings,
        List<SlotServiceLine> slotServices,
        List<RoomServiceLine> roomServices,
        Map<String, Map<String, Long>> roomSlotDays
) {

    public record Holding(String roomId, String roomNumber, String roomSlotId, String slotCode, DateRange range) {
    }

    public record SlotServiceLine(String slotServiceId, String roomSlotId, String serviceName, int quantity,
                                  BigDecimal unitPrice, boolean prorateByDay, DateRange active) {
    }

    /**
     * @param chargeId     confirmed meter reading (METERED only), null if missing
     * @param chargeAmount total amount of that reading for the whole room
     */
    public record RoomServiceLine(String roomServiceId, String roomId, String roomNumber, String serviceName,
                                  CalculationType calculationType, BigDecimal unitPrice, DateRange active,
                                  String chargeId, BigDecimal chargeAmount) {
    }
}
