package com.kitolam.rentalroommanagement.modules.shift.dto.response;

import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import java.util.List;

/** A room may be listed with an error so one legacy/broken configuration cannot hide its peers. */
public record BranchShiftResponse(String roomId, String roomNumber, String branchName, Long version,
                                  List<Shift.Period> periods, String errorCode, String message) { }
