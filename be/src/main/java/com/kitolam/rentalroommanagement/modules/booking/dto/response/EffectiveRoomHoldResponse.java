package com.kitolam.rentalroommanagement.modules.booking.dto.response;

public record EffectiveRoomHoldResponse(java.util.List<String> officialBookingIds, boolean temporarilyHeld, String revision) { }
