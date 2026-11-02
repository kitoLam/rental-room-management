package com.kitolam.rentalroommanagement.modules.contracttenant.dto.response;

public record EligibleContractTenantResponse(
        String tenantId,
        String fullName,
        String email,
        String phone
) {
}
