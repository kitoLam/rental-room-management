package com.kitolam.rentalroommanagement.security;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
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
        boolean enabled
) implements UserDetails {

    public AuthPrincipal(String userId, String email, String role) {
        this(userId, email, null, role, true);
    }

    public static AuthPrincipal from(User user) {
        return new AuthPrincipal(user.getId(), user.getEmail(), user.getPasswordHash(),
                user.getRole().name(), user.isEnabled() && user.isEmailVerified());
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
