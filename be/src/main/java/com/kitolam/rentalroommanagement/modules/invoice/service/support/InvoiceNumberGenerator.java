package com.kitolam.rentalroommanagement.modules.invoice.service.support;

import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

/** INV-{yyyyMM}-{seq}; the sequence is an atomic counter per month, so concurrent runs never collide. */
@Component
@RequiredArgsConstructor
public class InvoiceNumberGenerator {

    private static final String COLLECTION = "counters";
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyyMM");

    private final MongoTemplate mongoTemplate;

    public String next(YearMonth period) {
        String month = period.format(MONTH);
        Document counter = mongoTemplate.findAndModify(
                new Query(Criteria.where("_id").is("invoice-" + month)),
                new Update().inc("seq", 1),
                FindAndModifyOptions.options().upsert(true).returnNew(true),
                Document.class, COLLECTION);
        long seq = ((Number) counter.get("seq")).longValue();
        return "INV-%s-%04d".formatted(month, seq);
    }
}
