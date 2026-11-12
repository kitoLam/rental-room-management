package com.kitolam.rentalroommanagement.common.security;

import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.modules.auth.controller.AuthController;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.LoginRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RefreshTokenRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AccountIdentityResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.TokenResponse;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.RequestMapping;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SecurityRegressionTest {
    private static final String ID = "710000000000000000000001";
    private static final Clock NOW = Clock.fixed(Instant.parse("2026-10-28T01:00:00Z"), ZoneOffset.UTC);
    private final SecurityProperties properties = properties("security-regression");
    private final JwtProvider jwt = new JwtProvider(properties, NOW);
    private final AuthService accounts = mock(AuthService.class);

    private SecurityProperties properties(String issuer) {
        String key = Base64.getEncoder().encodeToString("test-only-signing-key-with-32-bytes".getBytes(StandardCharsets.UTF_8));
        return new SecurityProperties(key, issuer, "test-api", Duration.ofMinutes(15), Duration.ofDays(7),
                List.of("http://localhost:5173"), false, true, 10);
    }

    private User user() {
        var user = new User();
        user.setId(ID);
        user.setEmail("security@example.test");
        user.setRole(Role.OWNER);
        return user;
    }

    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    @Test void signedTokenRoundTripsWithExpectedIdentity() {
        var decoded = jwt.decode(jwt.createAccessToken(user()));
        assertEquals(ID, decoded.getSubject());
        assertEquals("OWNER", decoded.getClaimAsString("role"));
        assertEquals(NOW.instant().plus(Duration.ofMinutes(15)), decoded.getExpiresAt());
    }

    @Test void changingSignedPayloadIsRejected() {
        String token = jwt.createAccessToken(user());
        String[] parts = token.split("\\.");
        String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8)
                .replace("OWNER", "ADMIN");
        parts[1] = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        assertThrows(JwtException.class, () -> jwt.decode(String.join(".", parts)));
    }

    @Test void expiredAndWrongIssuerTokensAreRejected() {
        String token = jwt.createAccessToken(user());
        var later = new JwtProvider(properties, Clock.offset(NOW, Duration.ofMinutes(16)));
        assertThrows(JwtException.class, () -> later.decode(token));
        var differentIssuer = new JwtProvider(properties("another-issuer"), NOW);
        assertThrows(JwtException.class, () -> differentIssuer.decode(token));
    }

    @Test void currentDatabaseRoleOverridesOldJwtRole() throws Exception {
        when(accounts.findAccount(ID)).thenReturn(Optional.of(new AccountIdentityResponse(
                ID, "security@example.test", "User", null, "TENANT", true)));
        authenticate(jwt.createAccessToken(user()));
        var principal = (AuthPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertEquals("TENANT", principal.role());
        assertEquals("User", principal.fullName());
        assertFalse(principal.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_OWNER")));
        verify(accounts, times(1)).findAccount(ID);
    }

    @Test void disabledAndDeletedAccountsCannotUseExistingTokens() throws Exception {
        when(accounts.findAccount(ID)).thenReturn(Optional.of(new AccountIdentityResponse(
                ID, "security@example.test", "User", null, "OWNER", false)));
        authenticate(jwt.createAccessToken(user()));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        when(accounts.findAccount(ID)).thenReturn(Optional.empty());
        authenticate(jwt.createAccessToken(user()));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test void fakeDevelopmentHeadersAndMalformedTokensDoNotAuthenticate() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader("X-Viewing-Dev-Account", "owner");
        request.addHeader("X-Role", "OWNER");
        new JwtAuthenticationFilter(jwt, accounts).doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        authenticate("not-a-jwt");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(accounts);
    }

    @Test void viewingCorsAllowsEveryRequiredHeaderAndRejectsUntrustedOrigin() {
        var request = new MockHttpServletRequest();
        var cors = new CorsConfig().corsConfigurationSource(properties).getCorsConfiguration(request);
        assertNotNull(cors);
        assertEquals(3, cors.checkHeaders(List.of("authorization", "content-type", "idempotency-key")).size());
        assertEquals("http://localhost:5173", cors.checkOrigin("http://localhost:5173"));
        assertNull(cors.checkOrigin("https://untrusted.example"));
    }

    @Test void canonicalAuthRouteAndRefreshCookieArePreserved() {
        assertArrayEquals(new String[]{"/api/v1/auth"}, AuthController.class.getAnnotation(RequestMapping.class).value());
        when(accounts.login(any())).thenReturn(new TokenResponse("access", "refresh", "Bearer", 900, 604800));
        var response = new MockHttpServletResponse();
        new AuthController(accounts).login(new LoginRequest("security@example.test", "Test@1234"), response);
        String cookie = response.getHeader("Set-Cookie");
        assertNotNull(cookie);
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Lax"));
        assertTrue(cookie.contains("Path=/"));
    }

    @Test void cookieRefreshRotatesAndLogoutRevokesTheSameRefreshToken() {
        when(accounts.refresh(any())).thenReturn(new TokenResponse("next-access", "next-refresh", "Bearer", 900, 604800));
        var controller = new AuthController(accounts);
        var response = new MockHttpServletResponse();
        controller.refresh(null, "cookie-refresh", response);
        verify(accounts).refresh(new RefreshTokenRequest("cookie-refresh"));
        assertTrue(response.getHeader("Set-Cookie").contains("next-refresh"));
        var logoutResponse = new MockHttpServletResponse();
        controller.logout(null, "next-refresh", logoutResponse);
        verify(accounts).logout(new RefreshTokenRequest("next-refresh"));
        assertTrue(logoutResponse.getHeader("Set-Cookie").contains("Max-Age=0"));
        assertThrows(UnauthorizedException.class, () -> controller.refresh(null, null, new MockHttpServletResponse()));
    }

    private void authenticate(String token) throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        new JwtAuthenticationFilter(jwt, accounts).doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
    }
}
