package com.kitolam.rentalroommanagement.common.util;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Small helpers to build soft-delete-aware dynamic queries.
 * Reference fields are stored as ObjectId, so they must be compared with {@link #toObjectId(String)}.
 */
public final class MongoQueryHelper {

    public static final String IS_DELETED = "isDeleted";

    private MongoQueryHelper() {
    }

    public static Criteria notDeleted() {
        return Criteria.where(IS_DELETED).is(false);
    }

    public static List<Criteria> baseCriteria() {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(notDeleted());
        return criteria;
    }

    public static void addEquals(List<Criteria> criteria, String field, Object value) {
        if (value == null) {
            return;
        }
        criteria.add(Criteria.where(field).is(value instanceof Enum<?> e ? e.name() : value));
    }

    public static void addObjectIdEquals(List<Criteria> criteria, String field, String id) {
        if (StringUtils.hasText(id)) {
            criteria.add(Criteria.where(field).is(toObjectId(id)));
        }
    }

    public static void addKeyword(List<Criteria> criteria, String keyword, String... fields) {
        if (!StringUtils.hasText(keyword)) {
            return;
        }
        String regex = Pattern.quote(keyword.trim());
        Criteria[] matchers = Arrays.stream(fields)
                .map(field -> Criteria.where(field).regex(regex, "i"))
                .toArray(Criteria[]::new);
        criteria.add(new Criteria().orOperator(matchers));
    }

    public static ObjectId toObjectId(String id) {
        if (id == null || !ObjectId.isValid(id)) {
            throw new BadRequestException("Id không hợp lệ: " + id);
        }
        return new ObjectId(id);
    }

    public static <T> Page<T> page(MongoTemplate mongoTemplate, List<Criteria> criteria, Pageable pageable, Class<T> type) {
        Query query = new Query(new Criteria().andOperator(criteria)).with(pageable);
        List<T> content = mongoTemplate.find(query, type);
        return PageableExecutionUtils.getPage(content, pageable,
                () -> mongoTemplate.count(Query.of(query).limit(-1).skip(-1), type));
    }

    /**
     * True if another non-deleted document (other than {@code excludeId}) matches all conditions.
     * Used for business uniqueness, since soft-deleted rows must not block re-use of a value.
     */
    public static boolean existsOther(MongoTemplate mongoTemplate, Class<?> type, String excludeId, Criteria... conditions) {
        List<Criteria> criteria = baseCriteria();
        criteria.addAll(Arrays.asList(conditions));
        if (excludeId != null) {
            criteria.add(Criteria.where("id").ne(toObjectId(excludeId)));
        }
        return mongoTemplate.exists(new Query(new Criteria().andOperator(criteria)), type);
    }
}
