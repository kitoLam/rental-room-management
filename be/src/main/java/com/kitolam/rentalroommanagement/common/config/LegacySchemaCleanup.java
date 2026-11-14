package com.kitolam.rentalroommanagement.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * One-time schema cleanup, safe to run on every start (each step is a no-op once done):
 * <ol>
 *   <li>drops room_service_charges / slot_service_charges (invoices are computed from catalogs + meter readings);</li>
 *   <li>removes the per-contract rates / initial readings (rates live on the branch, readings in room_meter_readings);</li>
 *   <li>service catalogs, slot service requests and contract slot services: removes unit / calculationType;</li>
 *   <li>invoices: backfills contractId from contractTenantId, then removes contractTenantId, previousDebt and the
 *       charge references on items.</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LegacySchemaCleanup implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (String collection : new String[]{"room_service_charges", "slot_service_charges"}) {
            if (mongoTemplate.collectionExists(collection)) {
                mongoTemplate.dropCollection(collection);
                log.info("Dropped legacy collection {}", collection);
            }
        }

        long contracts = mongoTemplate.updateMulti(
                new Query(new Criteria().orOperator(exists("electricityInitialReading"), exists("waterInitialReading"),
                        exists("electricityRate"), exists("waterRate"), exists("parkingRate"))),
                new Update().unset("electricityInitialReading").unset("waterInitialReading")
                        .unset("electricityRate").unset("waterRate").unset("parkingRate"),
                "contracts").getModifiedCount();
        if (contracts > 0) log.info("Removed legacy rate / reading fields from {} contracts", contracts);

        // Service catalogs no longer have unit / calculationType (room services are always split per occupant).
        long catalogs = mongoTemplate.updateMulti(new Query(new Criteria().orOperator(exists("unit"), exists("calculationType"))),
                new Update().unset("unit").unset("calculationType"), "room_services").getModifiedCount()
                + mongoTemplate.updateMulti(new Query(exists("unit")), new Update().unset("unit"), "slot_services").getModifiedCount()
                + mongoTemplate.updateMulti(new Query(exists("unit")), new Update().unset("unit"), "slot_service_requests").getModifiedCount()
                + mongoTemplate.updateMulti(new Query(exists("activeSlotServices.unit")),
                new Update().unset("activeSlotServices.$[].unit"), "contracts").getModifiedCount();
        if (catalogs > 0) log.info("Removed unit / calculationType from {} service documents", catalogs);

        backfillInvoiceContractIds();
        long invoices = mongoTemplate.updateMulti(
                new Query(new Criteria().orOperator(exists("contractTenantId"), exists("previousDebt"))),
                new Update().unset("contractTenantId").unset("previousDebt"), "invoices").getModifiedCount();
        long items = mongoTemplate.updateMulti(
                new Query(new Criteria().orOperator(exists("items.roomServiceChargeId"), exists("items.slotServiceChargeId"))),
                new Update().unset("items.$[].roomServiceChargeId").unset("items.$[].slotServiceChargeId"),
                "invoices").getModifiedCount();
        if (invoices + items > 0) log.info("Cleaned legacy fields on {} invoices ({} with charge references)", invoices, items);
    }

    /** Old invoices only pointed to a contract-tenant record; copy its contractId before that field goes away. */
    private void backfillInvoiceContractIds() {
        Query legacy = new Query(new Criteria().andOperator(Criteria.where("contractId").exists(false), exists("contractTenantId")));
        legacy.fields().include("contractTenantId");
        int filled = 0;
        for (Document invoice : mongoTemplate.find(legacy, Document.class, "invoices")) {
            Object contractTenantId = invoice.get("contractTenantId");
            if (contractTenantId == null) continue;
            Query byId = new Query(Criteria.where("_id").is(contractTenantId));
            byId.fields().include("contractId");
            Document tenancy = mongoTemplate.findOne(byId, Document.class, "contract_tenants");
            Object contractId = tenancy == null ? null : tenancy.get("contractId");
            if (!(contractId instanceof ObjectId)) continue;
            try {
                mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(invoice.get("_id"))),
                        new Update().set("contractId", contractId), "invoices");
                filled++;
            } catch (DataAccessException e) {
                // Another live invoice already holds (contractId, period): leave this legacy one unlinked.
                log.warn("Could not backfill contractId on invoice {}: {}", invoice.get("_id"), e.getMessage());
            }
        }
        if (filled > 0) log.info("Backfilled contractId on {} legacy invoices", filled);
    }

    private static Criteria exists(String field) {
        return Criteria.where(field).exists(true);
    }
}
