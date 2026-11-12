package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.kitolam.rentalroommanagement.modules.auth.document.Role;

/** Query parameters for the Admin user list; all optional. */
public record AdminUserFilterRequest(Role role, String keyword) {
}
