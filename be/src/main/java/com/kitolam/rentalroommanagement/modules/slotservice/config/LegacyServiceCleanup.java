package com.kitolam.rentalroommanagement.modules.slotservice.config;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * room_services / slot_services used to hold "room X uses service Y" subscriptions; they are now
 * service catalogs. Old subscription documents (no name) are soft-deleted so they never show up in
 * the catalogs. Safe to run on every start.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LegacyServiceCleanup implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (String collection : new String[]{"room_services", "slot_services"}) {
            long n = mongoTemplate.updateMulti(
                    new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(), Criteria.where("name").exists(false))),
                    new Update().set(MongoQueryHelper.IS_DELETED, true).set("deletedAt", Instant.now()),
                    collection).getModifiedCount();
            if (n > 0) log.info("Soft-deleted {} legacy documents in {}", n, collection);
        }
    }
}
