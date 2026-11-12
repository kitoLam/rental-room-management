package com.kitolam.rentalroommanagement.modules.appointment.dto.response;

import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.Actor;
import java.util.Set;

public record ViewingContextResponse(
        String accountId,
        String tenantProfileId,
        String fullName,
        String phone,
        Set<String> roles,
        boolean canRequest,
        Set<String> manageableBranchIds
) {
    public static ViewingContextResponse from(Actor account) {
        return new ViewingContextResponse(account.accountId(), account.tenantProfileId(),
                account.fullName(), account.phone(), Set.of(account.principal().role()), account.canRequest(),
                account.manageableBranchIds());
    }
}
