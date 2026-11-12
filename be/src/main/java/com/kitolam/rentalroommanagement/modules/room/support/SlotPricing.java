package com.kitolam.rentalroommanagement.modules.room.support;

import com.kitolam.rentalroommanagement.modules.room.document.Room;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Room prices are for the whole room; one slot (one person) pays an equal share.
 * Used for booking deposits and for the rent / deposit written on each slot contract.
 */
public final class SlotPricing {

    private SlotPricing() {
    }

    public static BigDecimal rent(Room room) {
        return share(room.getListedRentPrice(), room);
    }

    public static BigDecimal deposit(Room room) {
        return share(room.getListedDepositAmount(), room);
    }

    private static BigDecimal share(BigDecimal roomAmount, Room room) {
        if (roomAmount == null) return null;
        int slots = room.getMaxOccupants() == null || room.getMaxOccupants() < 1 ? 1 : room.getMaxOccupants();
        return roomAmount.divide(BigDecimal.valueOf(slots), 0, RoundingMode.HALF_UP);
    }
}
