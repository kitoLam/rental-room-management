package com.kitolam.rentalroommanagement.common.base;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.Instant;

/**
 * Base class for every MongoDB document.
 * <ul>
 *   <li>createdAt / updatedAt are filled by Spring Data auditing (see MongoConfig).</li>
 *   <li>Soft delete: isDeleted starts as false, {@link #markDeleted()} flips it and stamps deletedAt.
 *       Every read query must filter {@code isDeleted = false}.</li>
 * </ul>
 */
@Getter
@Setter
public abstract class BaseDocument {

    @Id
    private String id;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant deletedAt = null;

    private Boolean isDeleted = false;

    public void markDeleted() {
        this.isDeleted = true;
        this.deletedAt = Instant.now();
    }
}
