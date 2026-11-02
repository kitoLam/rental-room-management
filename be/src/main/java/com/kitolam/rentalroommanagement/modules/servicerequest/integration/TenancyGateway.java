package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Read-only boundary to the contract / contract-tenant / slot-occupancy modules.
 * A real adapter must call those modules' public services, never their repositories,
 * and return empty when the tenant has no ACTIVE contract on the given date (fail closed).
 */
public interface TenancyGateway {

    /**
     * @param principal the logged-in tenant account
     * @param tenantId  tenant profile id, null when the account has no profile yet
     */
    Optional<ActiveTenancySnapshot> findActiveTenancy(AuthPrincipal principal, String tenantId, LocalDate onDate);
}
