package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserFilterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminRoleResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminUserResponse;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface AdminUserService {
    PagedResponse<AdminUserResponse> search(AdminUserFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Allowed transitions: TENANT -> OWNER and MANAGER -> TENANT. */
    AdminUserResponse updateRole(String id, AdminUserRoleUpdateRequest request, AuthPrincipal principal);

    List<AdminRoleResponse> roles(AuthPrincipal principal);
}
