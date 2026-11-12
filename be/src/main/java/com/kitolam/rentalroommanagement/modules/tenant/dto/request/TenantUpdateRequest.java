package com.kitolam.rentalroommanagement.modules.tenant.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. Never accepts password or sensitive data from manager/owner. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TenantUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String fullName,
        @Pattern(regexp = "^0[35789][0-9]{8}$", message = "Số di động Việt Nam phải gồm 10 số, đầu 03/05/07/08/09") String phone,
        @Past LocalDate dateOfBirth,
        Gender gender,
        String avatarUrl,
        String branchId,
        TenantStatus status
) {
    public TenantUpdateRequest {
        if (phone != null) {
            phone = phone.strip();
            if (phone.startsWith("+84")) {
                phone = "0" + phone.substring(3);
            }
        }
        branchId = (branchId == null || branchId.isBlank()) ? null : branchId.strip();
    }
}
