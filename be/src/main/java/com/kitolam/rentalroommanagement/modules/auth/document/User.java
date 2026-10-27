package com.kitolam.rentalroommanagement.modules.auth.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Getter
@Setter
@Document("users")
public class User extends BaseDocument {
    private String fullName;
    @Indexed(unique = true)
    private String email;
    @Indexed(unique = true)
    private String phone;
    private String passwordHash;
    private Role role = Role.TENANT;
    private boolean enabled;
    private boolean emailVerified;
    private Instant termsAcceptedAt;
    private Instant lastVerificationSentAt;
}
