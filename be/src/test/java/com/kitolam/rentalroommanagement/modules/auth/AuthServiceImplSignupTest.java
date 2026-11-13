package com.kitolam.rentalroommanagement.modules.auth;

import com.kitolam.rentalroommanagement.common.security.JwtProvider;
import com.kitolam.rentalroommanagement.common.security.SecurityProperties;
import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.SignupRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.UserProfileResponse;
import com.kitolam.rentalroommanagement.modules.auth.repository.AuthTokenStore;
import com.kitolam.rentalroommanagement.modules.auth.repository.RefreshTokenRepository;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.auth.repository.VerificationTokenRepository;
import com.kitolam.rentalroommanagement.modules.auth.service.impl.AuthServiceImpl;
import com.kitolam.rentalroommanagement.modules.auth.util.OpaqueTokenProvider;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplSignupTest {

    @Mock private UserRepository users;
    @Mock private VerificationTokenRepository verifications;
    @Mock private RefreshTokenRepository refreshTokens;
    @Mock private AuthTokenStore tokenStore;
    @Mock private PasswordEncoder passwords;
    @Mock private OpaqueTokenProvider tokens;
    @Mock private JwtProvider jwt;
    @Mock private SecurityProperties security;
    @Mock private ApplicationEventPublisher events;

    private AuthServiceImpl authService;
    private Validator validator;

    @BeforeEach
    void setUp() {
        when(tokens.generate()).thenReturn("raw-token-value");
        when(passwords.encode("raw-token-value")).thenReturn("dummy-hash");
        AuthProperties props = new AuthProperties(
                "http://localhost:5173",
                "noreply@example.com",
                Duration.ofMinutes(30),
                Duration.ofSeconds(60)
        );
        Clock fixedClock = Clock.fixed(Instant.parse("2026-11-12T08:00:00Z"), ZoneOffset.UTC);
        authService = new AuthServiceImpl(
                users,
                verifications,
                refreshTokens,
                tokenStore,
                passwords,
                tokens,
                jwt,
                security,
                props,
                events,
                fixedClock
        );
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void signup_shouldPersistPersonalAndCccdDetailsAndExposeInProfile() {
        SignupRequest req = new SignupRequest(
                "Nguyễn Văn An",
                "an@example.com",
                "0912345678",
                "1999-05-20",
                "12 Nguyễn Trãi, Thanh Xuân, Hà Nội",
                "001234567890",
                "2021-08-15",
                "Cục Cảnh sát QLHC về TTXH",
                "https://cdn.example.com/front.png",
                "https://cdn.example.com/back.png",
                "Test@1234",
                "Test@1234",
                true
        );

        assertTrue(validator.validate(req).isEmpty());
        when(users.findByEmailAndIsDeletedFalse("an@example.com")).thenReturn(Optional.empty());
        when(users.findByPhoneAndIsDeletedFalse("0912345678")).thenReturn(Optional.empty());
        when(passwords.encode("Test@1234")).thenReturn("hashed-pw");
        when(tokens.hash("raw-token-value")).thenReturn("hashed-token");

        authService.signup(req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(users).insert(captor.capture());
        User saved = captor.getValue();
        assertEquals("1999-05-20", saved.getDateOfBirth());
        assertEquals("12 Nguyễn Trãi, Thanh Xuân, Hà Nội", saved.getPermanentAddress());
        assertEquals("001234567890", saved.getCccdNumber());
        assertEquals("2021-08-15", saved.getCccdIssueDate());
        assertEquals("Cục Cảnh sát QLHC về TTXH", saved.getCccdIssuePlace());

        saved.setId("user-1");
        when(users.findByIdAndIsDeletedFalse("user-1")).thenReturn(Optional.of(saved));
        UserProfileResponse profile = authService.getProfile("user-1");
        assertEquals("1999-05-20", profile.dateOfBirth());
        assertEquals("12 Nguyễn Trãi, Thanh Xuân, Hà Nội", profile.permanentAddress());
        assertEquals("001234567890", profile.cccdNumber());
        assertEquals("2021-08-15", profile.cccdIssueDate());
        assertEquals("Cục Cảnh sát QLHC về TTXH", profile.cccdIssuePlace());
    }

    @Test
    void signupRequest_shouldRejectCccdIssueDateBeforeDateOfBirth() {
        SignupRequest invalid = new SignupRequest(
                "Nguyễn Văn An",
                "an@example.com",
                "0912345678",
                "2002-05-20",
                "12 Nguyễn Trãi, Hà Nội",
                "001234567890",
                "2000-01-01",
                "Cục Cảnh sát QLHC về TTXH",
                "https://cdn.example.com/front.png",
                "https://cdn.example.com/back.png",
                "Test@1234",
                "Test@1234",
                true
        );

        assertFalse(validator.validate(invalid).isEmpty());
    }
}
