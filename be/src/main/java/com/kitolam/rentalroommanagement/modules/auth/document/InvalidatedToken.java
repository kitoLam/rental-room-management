package com.kitolam.rentalroommanagement.modules.auth.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Blacklisted JWT. The inherited {@code id} holds the token's jti (a UUID string, not an ObjectId).
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "invalidated_tokens")
public class InvalidatedToken extends BaseDocument {

    private Date expirationTime;

    public InvalidatedToken(String jti, Date expirationTime) {
        setId(jti);
        this.expirationTime = expirationTime;
    }
}
