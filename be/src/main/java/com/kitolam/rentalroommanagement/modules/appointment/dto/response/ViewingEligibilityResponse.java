package com.kitolam.rentalroommanagement.modules.appointment.dto.response;

import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot.RentalMode;

/** Room eligibility only; not shift availability and not a reservation of a viewing shift. */
public record ViewingEligibilityResponse(
        String roomId,
        String branchId,
        String roomNumber,
        String branchName,
        String publicContactPhone,
        RentalMode rentalMode,
        boolean canReceiveRequest,
        Reason reason,
        java.util.List<com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingSlotSnapshot> slots
) {
    public ViewingEligibilityResponse(String roomId, String branchId, String roomNumber, String branchName,
                                       String publicContactPhone, RentalMode rentalMode, boolean canReceiveRequest, Reason reason) {
        this(roomId, branchId, roomNumber, branchName, publicContactPhone, rentalMode, canReceiveRequest, reason, java.util.List.of());
    }
    public enum Reason {
        AVAILABLE, BRANCH_INACTIVE, ROOM_UNAVAILABLE, TEMPORARY_HOLD, OFFICIAL_HOLD, NO_VACANCY, VIEWING_DISABLED
    }
}
