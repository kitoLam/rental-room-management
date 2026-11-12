package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends BaseRepository<User> {
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { isDeleted: false } }",
        "{ $group: { _id: { role: '$role', enabled: '$enabled', emailVerified: '$emailVerified' }, count: { $sum: 1 } } }",
        "{ $project: { _id: 0, role: '$_id.role', enabled: '$_id.enabled', emailVerified: '$_id.emailVerified', count: 1 } }"
    })
    List<com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminAccountStatistics.Group> readAccountGroups();

    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { isDeleted: false, createdAt: { $gte: ?0, $lt: ?1 } } }",
        "{ $group: { _id: { $month: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }, count: { $sum: 1 } } }",
        "{ $project: { _id: 0, month: '$_id', count: 1 } }"
    })
    List<com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminAccountStatistics.MonthCount> readRegistrations(
            java.time.Instant from, java.time.Instant to);

    @org.springframework.data.mongodb.repository.Query(value = "{ isDeleted: false }",
            fields = "{ fullName: 1, role: 1, createdAt: 1 }")
    List<User> readRecentForAdmin(org.springframework.data.domain.Pageable pageable);

    List<User> findByRoleInAndEnabledTrueAndEmailVerifiedTrueAndIsDeletedFalse(Collection<Role> roles);
    Optional<User> findByEmailAndIsDeletedFalse(String email);
    Optional<User> findByPhoneAndIsDeletedFalse(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
}
