package com.kitolam.rentalroommanagement.modules.auth.dto.request;

import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import jakarta.validation.constraints.NotNull;

/** Target role; only TENANT -> OWNER and MANAGER -> TENANT are accepted by the service. */
public record AdminUserRoleUpdateRequest(@NotNull(message = "Vai trò mới không được để trống") Role role) {
}
