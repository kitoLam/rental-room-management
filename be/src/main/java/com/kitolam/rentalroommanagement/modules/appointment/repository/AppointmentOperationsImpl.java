package com.kitolam.rentalroommanagement.modules.appointment.repository;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.mongodb.MongoException;
import org.bson.types.ObjectId;
import org.bson.Document;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.BasicQuery;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;

/** Database-coordinated guards. Callbacks must have no non-transactional external side effects. */
public class AppointmentOperationsImpl implements AppointmentOperations {
    private static final String GUARDS = "appointment_day_guards";
    private final MongoTemplate mongo;
    private final TransactionTemplate transactions;

    public AppointmentOperationsImpl(MongoTemplate mongo, MongoTransactionManager transactionManager) {
        this.mongo = mongo;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Override
    public <T> T withCreationGuards(String accountId, String roomId, String date, Supplier<T> action) {
        var keys = List.of("account:" + accountId + ":" + date, "room:" + roomId + ":" + date).stream().sorted().toList();
        for (String key : keys) {
            try {
                mongo.upsert(Query.query(Criteria.where("_id").is(key)), new Update().setOnInsert("revision", 0L), GUARDS);
            } catch (org.springframework.dao.DuplicateKeyException concurrentInitialization) {
                // The other request created the guard; acquire it in the transaction below.
            }
        }
        return inTransaction(() -> {
            for (String key : keys) mongo.updateFirst(Query.query(Criteria.where("_id").is(key)), new Update().inc("revision", 1L), GUARDS);
            return action.get();
        });
    }

    private <T> T inTransaction(Supplier<T> action) {
        for (int attempt = 0; attempt < 6; attempt++) {
            try {
                return transactions.execute(status -> action.get());
            } catch (RuntimeException error) {
                if (!transientTransactionError(error)) throw error;
                if (attempt == 5) break;
                try { Thread.sleep(10L * (attempt + 1)); }
                catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new ConflictException("Yêu cầu bị gián đoạn. Vui lòng thử lại với cùng mã gửi.");
                }
            }
        }
        throw new ConflictException("Dữ liệu đang được xử lý đồng thời. Vui lòng thử lại với cùng mã gửi.", "APPOINTMENT_BUSY");
    }

    private boolean transientTransactionError(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof MongoException ex && (ex.hasErrorLabel("TransientTransactionError")
                    || ex.hasErrorLabel("UnknownTransactionCommitResult") || ex.getCode() == 112)) return true;
        }
        return false;
    }

    @Override
    public int expireDue(Query scope, Instant now, ExpiryNotifications notifications) {
        Criteria due = new Criteria().andOperator(Criteria.where("isDeleted").is(false),
                Criteria.where("status").is(AppointmentStatus.PENDING.name()), new Criteria().orOperator(
                        Criteria.where("expiresAt").lte(now),
                        new Criteria().andOperator(Criteria.where("expiresAt").is(null), Criteria.where("startAt").lte(now)),
                        new Criteria().andOperator(Criteria.where("expiresAt").is(null), Criteria.where("createdAt").lte(now.minus(Duration.ofHours(24))))));
        Query candidates = new BasicQuery(new Document("$and", List.of(scope.getQueryObject(), Query.query(due).getQueryObject())));
        int changed = 0;
        for (Appointment appointment : mongo.find(candidates.limit(100), Appointment.class)) {
            String eventId = new ObjectId().toHexString();
            var event = new Appointment.HistoryEntry(eventId, "EXPIRED", null, "Hệ thống", now,
                    AppointmentStatus.PENDING, AppointmentStatus.EXPIRED, "Hết thời hạn duyệt lịch xem phòng");
            Update update = new Update().set("status", AppointmentStatus.EXPIRED).set("updatedAt", now)
                    .inc("actionVersion", 1L).push("history", event);
            notifications.append(appointment, eventId, update);
            Query target = Query.query(Criteria.where("_id").is(new ObjectId(appointment.getId()))).addCriteria(due);
            if (mongo.findAndModify(target, update, FindAndModifyOptions.options().returnNew(true), Appointment.class) != null) changed++;
        }
        return changed;
    }

    @Override
    public List<Appointment> automationCandidates(String afterId, Instant now, int limit) {
        var work = new Criteria().orOperator(Criteria.where("status").is(AppointmentStatus.PENDING.name()),
                new Criteria().andOperator(Criteria.where("status").is(AppointmentStatus.CONFIRMED.name()), Criteria.where("startAt").gt(now)),
                Criteria.where("notificationIntents.0").exists(true), Criteria.where("notificationRecipientRetries.0").exists(true));
        Query query = Query.query(new Criteria().andOperator(Criteria.where("isDeleted").is(false), work));
        if (afterId != null) query.addCriteria(Criteria.where("_id").gt(new ObjectId(afterId)));
        return mongo.find(query.with(org.springframework.data.domain.Sort.by("_id")).limit(limit), Appointment.class);
    }

    @Override
    public <T> T withAutomationGuard(String id, Supplier<T> action) {
        return inTransaction(() -> {
            if (mongo.updateFirst(Query.query(Criteria.where("_id").is(new ObjectId(id)).and("isDeleted").is(false)),
                    new Update().inc("automationFence", 1L), Appointment.class).getModifiedCount() == 0) return null;
            return action.get();
        });
    }

    @Override
    public Appointment updateAutomation(String id, Update update) {
        return mongo.findAndModify(Query.query(Criteria.where("_id").is(new ObjectId(id)).and("isDeleted").is(false)),
                update, FindAndModifyOptions.options().returnNew(true), Appointment.class);
    }

    @Override
    public Appointment applyAction(String id, AppointmentStatus status, long version, Instant now, Instant selfCancellationDeadline, Update update) {
        Query target = Query.query(Criteria.where("_id").is(new ObjectId(id)).and("isDeleted").is(false)
                .and("status").is(status.name()));
        // Existing documents predate actionVersion; missing/null is version zero.
        target.addCriteria(version == 0 ? new Criteria().orOperator(Criteria.where("actionVersion").is(0L),
                Criteria.where("actionVersion").exists(false)) : Criteria.where("actionVersion").is(version));
        List<Document> timeChecks = new java.util.ArrayList<>();
        if (status == AppointmentStatus.PENDING) {
            target.addCriteria(Criteria.where("expiresAt").gt(now).and("startAt").gt(now));
            // Also evaluate the database clock at the write, in case a request waited past its deadline.
            timeChecks.add(new Document("$gt", List.of("$expiresAt", "$$NOW")));
            timeChecks.add(new Document("$gt", List.of("$startAt", "$$NOW")));
        }
        if (selfCancellationDeadline != null) timeChecks.add(new Document("$lte", List.of("$$NOW", java.util.Date.from(selfCancellationDeadline))));
        if (!timeChecks.isEmpty()) target = new BasicQuery(target.getQueryObject().append("$expr", new Document("$and", timeChecks)));
        return mongo.findAndModify(target, update.inc("actionVersion", 1L).set("updatedAt", now),
                FindAndModifyOptions.options().returnNew(true), Appointment.class);
    }
}
