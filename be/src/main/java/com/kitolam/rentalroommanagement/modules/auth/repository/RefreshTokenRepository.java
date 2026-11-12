package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.RefreshToken;
import java.util.Optional;

public interface RefreshTokenRepository extends BaseRepository<RefreshToken> {
    Optional<RefreshToken> findByTokenHashAndIsDeletedFalse(String tokenHash);
}
