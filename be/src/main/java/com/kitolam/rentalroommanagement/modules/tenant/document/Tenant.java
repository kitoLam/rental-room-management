package com.kitolam.rentalroommanagement.modules.tenant.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "tenants")
public class Tenant extends BaseDocument {

    private String fullName;

    @Indexed
    private String email;

    @Indexed
    private String phone;

    private String passwordHash;

    private LocalDate dateOfBirth;

    private Gender gender;

    @Indexed
    private String idCardNumber;

    private String address;

    private String avatarUrl;

    private TenantStatus status = TenantStatus.ACTIVE;
}
