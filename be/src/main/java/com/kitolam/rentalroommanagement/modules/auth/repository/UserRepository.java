package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends BaseRepository<User> {
    List<User> findByRoleInAndEnabledTrueAndEmailVerifiedTrueAndIsDeletedFalse(Collection<Role> roles);
    Optional<User> findByEmailAndIsDeletedFalse(String email);
    Optional<User> findByPhoneAndIsDeletedFalse(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
}
