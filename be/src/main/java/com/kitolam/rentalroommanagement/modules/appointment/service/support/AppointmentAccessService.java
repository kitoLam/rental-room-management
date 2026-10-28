package com.kitolam.rentalroommanagement.modules.appointment.service.support;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Viewing-specific scope; authentication and account status are validated by the shared JWT filter. */
@Component
@RequiredArgsConstructor
public class AppointmentAccessService {
    private final AuthService accounts;
    private final BranchService branches;
    private final ManagerService managers;
    private final TenantService tenants;

    public Optional<Actor> currentAccount() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) return Optional.empty();
        return Optional.of(actor(principal));
    }

    /** Background jobs resolve recipients without an HTTP session or a logged-in user. */
    public List<Actor> managementAccounts(String branchId) {
        return accounts.activeManagementAccounts().stream().filter(account -> account.active())
                .map(AuthPrincipal::from).map(this::actor).filter(actor -> actor.canManage(branchId)).toList();
    }

    private Actor actor(AuthPrincipal principal) {
        Set<String> scope = Set.of();
        if (principal.enabled() && "OWNER".equals(principal.role())) {
            scope = branches.ownedBranchIds(principal.userId());
        } else if (principal.enabled() && "MANAGER".equals(principal.role())) {
            scope = managers.findAssignment(principal.email())
                    .filter(manager -> manager.status() == ManagerStatus.ACTIVE && manager.branchId() != null)
                    .filter(manager -> manager.permissions() != null
                            && manager.permissions().contains(ManagerService.VIEWING_PERMISSION))
                    .map(manager -> Set.of(manager.branchId())).orElse(Set.of());
        }
        String tenantId = principal.enabled() && "TENANT".equals(principal.role())
                ? tenants.profileIdByEmail(principal.email()).orElse(null) : null;
        return new Actor(principal, tenantId, scope);
    }

    public record Actor(AuthPrincipal principal, String tenantProfileId, Set<String> manageableBranchIds) {
        public Actor {
            manageableBranchIds = Set.copyOf(manageableBranchIds);
        }

        public String accountId() { return principal.userId(); }
        public String fullName() { return principal.fullName(); }
        public String phone() { return principal.phone(); }
        public boolean active() { return principal.enabled(); }
        public boolean canRequest() { return active() && "TENANT".equals(principal.role()); }
        public boolean canManage(String branchId) { return active() && branchId != null && manageableBranchIds.contains(branchId); }
    }
}
