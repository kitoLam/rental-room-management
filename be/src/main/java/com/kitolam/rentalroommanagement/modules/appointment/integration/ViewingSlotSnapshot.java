package com.kitolam.rentalroommanagement.modules.appointment.integration;

import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import java.time.LocalDate;

/** Slot eligibility for a viewing date, independent of booking release/holding rules. */
public record ViewingSlotSnapshot(String id, String slotCode, RoomSlotStatus status,
                                  boolean selectable, boolean available, LocalDate availableFrom, String reason, String message) { }
