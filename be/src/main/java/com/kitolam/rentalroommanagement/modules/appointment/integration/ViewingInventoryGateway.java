package com.kitolam.rentalroommanagement.modules.appointment.integration;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Read-only room/booking boundary. A real adapter should call owning module services,
 * not their repositories, and supply an explicit rental mode and effective hold semantics.
 * Unknown source data must fail closed rather than silently treating a room as available.
 */
public interface ViewingInventoryGateway {
    ViewingRoomSnapshot getRoom(String roomId);

    /** Authoritative branch membership, including private/unavailable rooms for management.
     * No inference from FE data or from which rooms already have shift configurations.
     */
    default Page<ViewingRoomSnapshot> roomsInBranch(String branchId, Pageable pageable) {
        throw new UnsupportedOperationException("Tích hợp danh sách phòng theo chi nhánh chưa sẵn sàng");
    }
}
