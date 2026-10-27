package com.kitolam.rentalroommanagement.security;

import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthUserDetailsService implements UserDetailsService {
    private final UserRepository users;

    @Override
    public AuthPrincipal loadUserByUsername(String email) {
        return users.findByEmailAndIsDeletedFalse(email)
                .map(AuthPrincipal::from).orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    public AuthPrincipal loadById(String userId) {
        return users.findByIdAndIsDeletedFalse(userId)
                .map(AuthPrincipal::from).orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }
}
