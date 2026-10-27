package com.kitolam.rentalroommanagement.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtProvider jwt;
    private final AuthUserDetailsService users;
    private final SecurityErrorHandler errors;
    private final boolean requireHttps;

    public JwtAuthenticationFilter(JwtProvider jwt, AuthUserDetailsService users,
                                   SecurityErrorHandler errors, boolean requireHttps) {
        this.jwt = jwt;
        this.users = users;
        this.errors = errors;
        this.requireHttps = requireHttps;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (requireHttps && !request.isSecure()) {
            errors.write(response, 400, "Vui lòng sử dụng HTTPS");
            return;
        }
        // Token responses and verification URLs must not be cached or leaked via referrers.
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            try {
                if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                        || authorization.length() > 8192) throw new BadCredentialsException("Invalid bearer token");
                var claims = jwt.decode(authorization.substring(7));
                var principal = users.loadById(claims.getSubject());
                if (!principal.isEnabled() || !principal.email().equals(claims.getClaimAsString("email"))
                        || !principal.role().equals(claims.getClaimAsString("role"))) {
                    throw new BadCredentialsException("Inactive account or changed claims");
                }
                var authentication = UsernamePasswordAuthenticationToken.authenticated(
                        principal, null, principal.getAuthorities());
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            } catch (JwtException | AuthenticationException | IllegalArgumentException ex) {
                SecurityContextHolder.clearContext();
                errors.commence(request, response, new BadCredentialsException("Invalid bearer token"));
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
