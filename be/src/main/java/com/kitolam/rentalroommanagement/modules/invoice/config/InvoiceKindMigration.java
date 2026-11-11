package com.kitolam.rentalroommanagement.modules.invoice.config;

import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * One-off data fix for supplementary invoices:
 * drops the old unique index {contractId, period} (it would block a second invoice in the same month)
 * and marks invoices created before the kind field existed as MONTHLY. Safe to run on every start.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InvoiceKindMigration implements ApplicationRunner {

    private static final String OLD_INDEX = "contract_id_period_uq";

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        var indexOps = mongoTemplate.indexOps(Invoice.class);
        if (indexOps.getIndexInfo().stream().map(IndexInfo::getName).anyMatch(OLD_INDEX::equals)) {
            indexOps.dropIndex(OLD_INDEX);
            log.info("Dropped old invoice index {}", OLD_INDEX);
        }
        long updated = mongoTemplate.updateMulti(new Query(Criteria.where("kind").exists(false)),
                new Update().set("kind", InvoiceKind.MONTHLY.name()), Invoice.class).getModifiedCount();
        if (updated > 0) log.info("Set kind=MONTHLY on {} invoices", updated);
    }
}
