package com.kitolam.rentalroommanagement.modules.branch.support;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Optional;

/** A room has no manager of its own: its manager is the active manager assigned to its branch. */
@Component
@RequiredArgsConstructor
public class BranchManagerResolver {

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;

    /** Active manager profile of the branch, if any. */
    public Optional<Manager> manager(String branchId) {
        if (!StringUtils.hasText(branchId) || !org.bson.types.ObjectId.isValid(branchId)) return Optional.empty();
        return Optional.ofNullable(mongoTemplate.findOne(new Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)),
                Criteria.where("status").is(ManagerStatus.ACTIVE.name()))), Manager.class));
    }

    /** Login account id of the branch's active manager (matched by email), if any. */
    public Optional<String> managerAccountId(String branchId) {
        return manager(branchId)
                .flatMap(manager -> userRepository.findByEmailAndIsDeletedFalse(manager.getEmail()))
                .map(User::getId);
    }
}
