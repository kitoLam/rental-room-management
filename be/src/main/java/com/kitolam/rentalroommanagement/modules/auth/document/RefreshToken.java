package com.kitolam.rentalroommanagement.modules.auth.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.*;
import java.time.Instant;

@Getter
@Setter
@Document("refresh_tokens")
public class RefreshToken extends BaseDocument {
    @Indexed(unique = true)
    private String tokenHash;
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String userId;
    private Instant expiresAt;
    private Instant revokedAt;
    @Indexed(expireAfter = "0s")
    private Instant purgeAt;
}
