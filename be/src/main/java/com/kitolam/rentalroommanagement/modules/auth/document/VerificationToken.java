package com.kitolam.rentalroommanagement.modules.auth.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.*;
import java.time.Instant;

@Getter
@Setter
@Document("verification_tokens")
public class VerificationToken extends BaseDocument {
    @Indexed(unique = true)
    private String tokenHash;
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String userId;
    private Instant expiresAt;
    private Instant usedAt;
    // Keep expired/used tokens briefly to distinguish errors; never TTL-delete users.
    @Indexed(expireAfter = "0s")
    private Instant purgeAt;
}
