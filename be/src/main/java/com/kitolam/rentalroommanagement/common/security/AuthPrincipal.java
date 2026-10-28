package com.kitolam.rentalroommanagement.common.security;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AccountIdentityResponse;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public record AuthPrincipal(
        String userId,
        String email,
        String passwordHash,
        String role,
        boolean enabled,
        String fullName,
        String phone
) implements UserDetails {

    public AuthPrincipal(String userId, String email, String passwordHash, String role, boolean enabled) {
        this(userId, email, passwordHash, role, enabled, null, null);
    }

    public AuthPrincipal(String userId, String email, String role) {
        this(userId, email, null, role, true);
    }

    public static AuthPrincipal from(User user) {
        return new AuthPrincipal(user.getId(), user.getEmail(), user.getPasswordHash(),
                user.getRole().name(), user.isEnabled() && user.isEmailVerified(), user.getFullName(), user.getPhone());
    }

    public static AuthPrincipal from(AccountIdentityResponse account) {
        return new AuthPrincipal(account.id(), account.email(), null, account.role(), account.active(),
                account.fullName(), account.phone());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public String toString() {
        return "AuthPrincipal[REDACTED]";
    }
}
