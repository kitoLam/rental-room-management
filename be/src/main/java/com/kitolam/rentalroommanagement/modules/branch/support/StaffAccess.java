package com.kitolam.rentalroommanagement.modules.branch.support;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Access checks for staff-only features (owner / manager / admin), scoped by branch. */
@Component
@RequiredArgsConstructor
public class StaffAccess {

    private static final List<String> STAFF_ROLES = List.of("OWNER", "MANAGER", "ADMIN");

    private final BranchService branchService;

    public void requireStaff(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        if (!STAFF_ROLES.contains(principal.role())) throw new ForbiddenException("Chỉ Owner/Manager mới được thao tác");
    }

    /** Admin may act on any (existing) branch; owner / manager only on their own. */
    public void requireBranch(String branchId, AuthPrincipal principal) {
        requireStaff(principal);
        if (isAdmin(principal)) branchService.getById(branchId);
        else branchService.requireManagementAccess(branchId, principal);
    }

    public boolean isAdmin(AuthPrincipal principal) {
        return principal != null && "ADMIN".equals(principal.role());
    }

    /** Branch ids the principal can manage; null means every branch (admin). */
    public Set<String> manageableBranchIds(AuthPrincipal principal) {
        requireStaff(principal);
        if (isAdmin(principal)) return null;
        return branchService.managedBranches(principal).stream()
                .map(BranchResponse::id)
                .collect(Collectors.toUnmodifiableSet());
    }
}
