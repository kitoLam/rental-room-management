package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Read-only boundary to the contract / contract-tenant / slot-occupancy modules.
 * A real adapter must call those modules' public services, never their repositories,
 * and return empty when the tenant has no ACTIVE contract on the given date (fail closed).
 */
public interface TenancyGateway {

    /**
     * @param tenantId     tenant profile id, null when the account has no profile yet
     * @param accountEmail email of the logged-in account
     */
    Optional<ActiveTenancySnapshot> findActiveTenancy(String tenantId, String accountEmail, LocalDate onDate);
}
