package com.kitolam.rentalroommanagement.modules.notification.dto.request;

import java.util.Set;

/** Scope comes from the caller's trusted authentication adapter, never an HTTP request body. */
public record NotificationScope(String accountId, Set<String> manageableBranchIds) {
    public NotificationScope { manageableBranchIds = Set.copyOf(manageableBranchIds); }
}
