package com.kitolam.rentalroommanagement.modules.manager.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;

public interface ManagerRepository extends BaseRepository<Manager> {
    java.util.Optional<Manager> findByEmailAndIsDeletedFalse(String email);
}
