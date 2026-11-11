package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.modules.auth.document.*;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Repository;
import java.time.Instant;

@Repository
@RequiredArgsConstructor
public class AuthTokenStore {
    private final MongoTemplate mongo;

    // Compare-and-set predicates also protect multiple application instances.
    public boolean consumeVerification(String hash, Instant now) {
        return consumeVerification(hash, TokenPurpose.EMAIL_VERIFICATION, now);
    }

    public boolean consumeVerification(String hash, TokenPurpose expectedPurpose, Instant now) {
        Criteria purposeCriteria = expectedPurpose == TokenPurpose.EMAIL_VERIFICATION
                ? new Criteria().orOperator(
                        Criteria.where("purpose").is(TokenPurpose.EMAIL_VERIFICATION),
                        Criteria.where("purpose").is(null))
                : Criteria.where("purpose").is(expectedPurpose);
        var criteria = new Criteria().andOperator(
                Criteria.where("tokenHash").is(hash).and("isDeleted").is(false)
                        .and("usedAt").is(null).and("expiresAt").gt(now),
                purposeCriteria);
        return mongo.updateFirst(Query.query(criteria),
                new Update().set("usedAt", now).set("updatedAt", now), VerificationToken.class)
                .getModifiedCount() == 1;
    }

    public boolean revokeRefresh(String hash, Instant now) {
        var criteria = Criteria.where("tokenHash").is(hash).and("isDeleted").is(false)
                .and("revokedAt").is(null).and("expiresAt").gt(now);
        return mongo.updateFirst(Query.query(criteria),
                new Update().set("revokedAt", now).set("updatedAt", now), RefreshToken.class)
                .getModifiedCount() == 1;
    }

    public boolean claimResend(String userId, Instant cutoff, Instant now) {
        var criteria = Criteria.where("_id").is(new ObjectId(userId)).and("isDeleted").is(false)
                .and("enabled").is(false)
                .orOperator(Criteria.where("lastVerificationSentAt").lte(cutoff),
                        Criteria.where("lastVerificationSentAt").is(null));
        return mongo.updateFirst(Query.query(criteria),
                new Update().set("lastVerificationSentAt", now).set("updatedAt", now), User.class)
                .getModifiedCount() == 1;
    }

    public void invalidateVerifications(String userId, Instant now) {
        var criteria = Criteria.where("userId").is(new ObjectId(userId))
                .and("isDeleted").is(false).and("usedAt").is(null);
        mongo.updateMulti(Query.query(criteria),
                new Update().set("usedAt", now).set("updatedAt", now), VerificationToken.class);
    }
}
