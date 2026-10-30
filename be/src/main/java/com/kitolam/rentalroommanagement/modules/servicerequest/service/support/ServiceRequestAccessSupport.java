package com.kitolam.rentalroommanagement.modules.servicerequest.service.support;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AccountIdentityResponse;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.servicerequest.integration.ActiveTenancySnapshot;
import com.kitolam.rentalroommanagement.modules.servicerequest.integration.TenancyGateway;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import java.util.stream.Collectors;

/** Who the caller is and which tenancy / branches they may act on, for the service request flow. */
@Component
@RequiredArgsConstructor
public class ServiceRequestAccessSupport {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final TenantService tenants;
    private final TenancyGateway tenancies;
    private final BranchService branches;
    private final ManagerService managers;
    private final AuthService accounts;
    private final Clock clock;

    public Instant now() {
        return clock.instant();
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    public LocalDate dateOf(Instant at) {
        return LocalDate.ofInstant(at, ZONE);
    }

    public ActiveTenancySnapshot requireTenancy(AuthPrincipal principal) {
        requireAuthenticated(principal);
        if (!hasRole(principal, "TENANT")) {
            throw new ForbiddenException("Chỉ người thuê mới gửi được yêu cầu dịch vụ");
        }
        String tenantId = principal.email() == null ? null : tenants.profileIdByEmail(principal.email()).orElse(null);
        return tenancies.findActiveTenancy(tenantId, principal.email(), today())
                .orElseThrow(() -> new ForbiddenException("Bạn chưa có hợp đồng thuê đang hiệu lực"));
    }

    /** Branches the caller manages; empty for tenants. */
    public ManagementScope managementScope(AuthPrincipal principal) {
        requireAuthenticated(principal);
        if (hasRole(principal, "ADMIN")) return ManagementScope.everyBranch();
        if (hasRole(principal, "OWNER")) return ManagementScope.of(branches.ownedBranchIds(principal.userId()));
        if (hasRole(principal, "MANAGER")) {
            return ManagementScope.of(managers.findAssignment(principal.email())
                    .filter(manager -> manager.status() == ManagerStatus.ACTIVE && manager.branchId() != null)
                    .map(manager -> Set.of(manager.branchId())).orElse(Set.of()));
        }
        return ManagementScope.of(Set.of());
    }

    public ManagementScope requireManagementScope(AuthPrincipal principal) {
        ManagementScope scope = managementScope(principal);
        if (!scope.all() && scope.branchIds().isEmpty()) {
            throw new ForbiddenException("Bạn không có quyền quản lý yêu cầu dịch vụ");
        }
        return scope;
    }

    /** Active managers and owners of the branch; admins are not notified for every request. */
    public Set<String> managementRecipients(String branchId) {
        return accounts.activeManagementAccounts().stream()
                .filter(AccountIdentityResponse::active)
                .filter(account -> "MANAGER".equals(account.role()) || "OWNER".equals(account.role()))
                .filter(account -> managementScope(AuthPrincipal.from(account)).includes(branchId))
                .map(AccountIdentityResponse::id)
                .collect(Collectors.toSet());
    }

    private static void requireAuthenticated(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
    }

    private static boolean hasRole(AuthPrincipal principal, String role) {
        return principal.enabled() && role.equals(principal.role());
    }

    public record ManagementScope(boolean all, Set<String> branchIds) {

        public ManagementScope {
            branchIds = Set.copyOf(branchIds);
        }

        static ManagementScope everyBranch() {
            return new ManagementScope(true, Set.of());
        }

        static ManagementScope of(Set<String> branchIds) {
            return new ManagementScope(false, branchIds);
        }

        public boolean includes(String branchId) {
            return branchId != null && (all || branchIds.contains(branchId));
        }
    }
}
