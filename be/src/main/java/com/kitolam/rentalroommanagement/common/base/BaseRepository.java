package com.kitolam.rentalroommanagement.common.base;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.Optional;

/**
 * Shared repository for documents extending {@link BaseDocument}.
 * findWithPagination is implemented in {@link BaseRepositoryImpl}; every method here ignores soft-deleted documents.
 */
@NoRepositoryBean
public interface BaseRepository<T extends BaseDocument> extends MongoRepository<T, String> {

    Optional<T> findByIdAndIsDeletedFalse(String id);

    boolean existsByIdAndIsDeletedFalse(String id);

    /** Page of all non-deleted documents. */
    Page<T> findWithPagination(Pageable pageable);

    /**
     * Page of non-deleted documents matching {@code criteria} (null = no extra condition).
     * Reference fields are stored as ObjectId, so compare them with MongoQueryHelper.toObjectId(...).
     */
    Page<T> findWithPagination(Criteria criteria, Pageable pageable);
}
