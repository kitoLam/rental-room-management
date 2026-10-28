package com.kitolam.rentalroommanagement.modules.shift.dto.response;

import java.util.List;

public record ShiftBulkUpdateResponse(String branchId, int updated, int unchanged, int failed,
                                       List<RoomResult> results) {
    public record RoomResult(String roomId, String roomNumber, Status status, Long version,
                              String code, String message, List<ShiftResponse.ExistingAppointment> affectedAppointments) { }
    public enum Status { UPDATED, UNCHANGED, FAILED }

    public static ShiftBulkUpdateResponse from(String branchId, List<RoomResult> results) {
        return new ShiftBulkUpdateResponse(branchId,
                (int) results.stream().filter(r -> r.status() == Status.UPDATED).count(),
                (int) results.stream().filter(r -> r.status() == Status.UNCHANGED).count(),
                (int) results.stream().filter(r -> r.status() == Status.FAILED).count(), List.copyOf(results));
    }
}
