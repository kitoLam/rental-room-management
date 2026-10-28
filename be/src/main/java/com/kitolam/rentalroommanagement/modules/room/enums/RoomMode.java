package com.kitolam.rentalroommanagement.modules.room.enums;

/** How a room is rented out; also decides what Room.maxOccupants means. */
public enum RoomMode {
    /** Rented as one unit; maxOccupants = max number of people allowed in the room. */
    WHOLE_ROOM,
    /** Rented by slot (bed); maxOccupants = number of slots in the room. */
    PER_SLOT
}
