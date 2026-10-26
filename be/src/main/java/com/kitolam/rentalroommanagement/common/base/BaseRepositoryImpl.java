package com.kitolam.rentalroommanagement.common.base;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.repository.query.MongoEntityInformation;
import org.springframework.data.mongodb.repository.support.SimpleMongoRepository;
import org.springframework.data.support.PageableExecutionUtils;

import java.util.List;

/**
 * Base class behind every module repository (registered via repositoryBaseClass in MongoConfig).
 * Spring Data routes the custom methods declared in {@link BaseRepository} here by signature.
 */
public class BaseRepositoryImpl<T extends BaseDocument> extends SimpleMongoRepository<T, String> {

    private final MongoOperations mongoOperations;
    private final MongoEntityInformation<T, String> entityInformation;

    public BaseRepositoryImpl(MongoEntityInformation<T, String> entityInformation, MongoOperations mongoOperations) {
        super(entityInformation, mongoOperations);
        this.entityInformation = entityInformation;
        this.mongoOperations = mongoOperations;
    }

    public Page<T> findWithPagination(Pageable pageable) {
        return findWithPagination(null, pageable);
    }

    public Page<T> findWithPagination(Criteria criteria, Pageable pageable) {
        Criteria where = criteria == null
                ? MongoQueryHelper.notDeleted()
                : new Criteria().andOperator(MongoQueryHelper.notDeleted(), criteria);
        Query query = new Query(where).with(pageable);

        Class<T> type = entityInformation.getJavaType();
        String collection = entityInformation.getCollectionName();
        List<T> content = mongoOperations.find(query, type, collection);
        // Count runs only when needed (e.g. not on a last, partially filled page)
        return PageableExecutionUtils.getPage(content, pageable,
                () -> mongoOperations.count(Query.of(query).limit(-1).skip(-1), type, collection));
    }
}
