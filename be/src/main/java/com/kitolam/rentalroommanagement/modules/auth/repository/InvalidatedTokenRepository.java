package com.kitolam.rentalroommanagement.modules.auth.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.auth.document.InvalidatedToken;
import org.springframework.stereotype.Repository;

@Repository
public interface InvalidatedTokenRepository extends BaseRepository<InvalidatedToken> {

}
