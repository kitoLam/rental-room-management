package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Default until the contract module exposes the active tenancy of a tenant.
 * Tenant endpoints answer 501 instead of guessing a room. Replace with a real adapter
 * that calls the contract module's public service.
 */
@Component
@ConditionalOnProperty(prefix = "service-request.tenancy-stub", name = "enabled", havingValue = "false", matchIfMissing = true)
public class UnavailableTenancyGateway implements TenancyGateway {

    @Override
    public Optional<ActiveTenancySnapshot> findActiveTenancy(String tenantId, String accountEmail, LocalDate onDate) {
        throw new UnsupportedOperationException("Tích hợp hợp đồng thuê chưa sẵn sàng");
    }
}
