package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.VerificationToken;
import java.util.Optional;

public interface VerificationTokenRepository extends BaseRepository<VerificationToken> {
    Optional<VerificationToken> findByTokenHashAndIsDeletedFalse(String tokenHash);
}
