package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import java.util.Optional;

public interface UserRepository extends BaseRepository<User> {
    Optional<User> findByEmailAndIsDeletedFalse(String email);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
}
