package com.kitolam.rentalroommanagement.modules.auth.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.*;
import com.kitolam.rentalroommanagement.common.security.*;
import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import com.kitolam.rentalroommanagement.modules.auth.document.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.*;
import com.kitolam.rentalroommanagement.modules.auth.repository.*;
import com.kitolam.rentalroommanagement.modules.auth.service.*;
import com.kitolam.rentalroommanagement.modules.auth.util.OpaqueTokenProvider;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServiceImpl implements AuthService {
    private static final String INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng";
    private static final String RESEND_MESSAGE =
            "Nếu email có tài khoản chưa xác thực, liên kết xác thực sẽ được gửi. Vui lòng kiểm tra email";
    private final UserRepository users;
    private final VerificationTokenRepository verifications;
    private final RefreshTokenRepository refreshTokens;
    private final AuthTokenStore tokenStore;
    private final PasswordEncoder passwords;
    private final OpaqueTokenProvider tokens;
    private final JwtProvider jwt;
    private final SecurityProperties security;
    private final AuthProperties properties;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final String dummyPasswordHash;

    @Override
    public Optional<AccountIdentityResponse> findAccount(String id) {
        return users.findByIdAndIsDeletedFalse(id).map(this::identity);
    }

    @Override
    public List<AccountIdentityResponse> activeManagementAccounts() {
        return users.findByRoleInAndEnabledTrueAndEmailVerifiedTrueAndIsDeletedFalse(List.of(Role.OWNER, Role.MANAGER))
                .stream().map(this::identity).toList();
    }

    private AccountIdentityResponse identity(User user) {
        return new AccountIdentityResponse(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(),
                user.getRole().name(), user.isEnabled() && user.isEmailVerified());
    }

    public AuthServiceImpl(UserRepository users, VerificationTokenRepository verifications,
            RefreshTokenRepository refreshTokens, AuthTokenStore tokenStore, PasswordEncoder passwords,
            OpaqueTokenProvider tokens, JwtProvider jwt, SecurityProperties security,
            AuthProperties properties, ApplicationEventPublisher events, Clock clock) {
        this.users = users;
        this.verifications = verifications;
        this.refreshTokens = refreshTokens;
        this.tokenStore = tokenStore;
        this.passwords = passwords;
        this.tokens = tokens;
        this.jwt = jwt;
        this.security = security;
        this.properties = properties;
        this.events = events;
        this.clock = clock;
        // Unknown emails still perform BCrypt work, reducing account-enumeration timing differences.
        this.dummyPasswordHash = passwords.encode(tokens.generate());
    }

    @Override
    @Transactional
    public MessageResponse signup(SignupRequest request) {
        var existingEmail = users.findByEmailAndIsDeletedFalse(request.email()).orElse(null);
        if (existingEmail != null && existingEmail.isEmailVerified()) {
            throw new ConflictException("Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.");
        }
        var existingPhone = users.findByPhoneAndIsDeletedFalse(request.phone()).orElse(null);
        if (existingPhone != null && (existingEmail == null || !existingPhone.getId().equals(existingEmail.getId()))) {
            throw new ConflictException("Số điện thoại này đã được sử dụng. Vui lòng chọn số khác.");
        }
        var now = clock.instant();
        User user = existingEmail != null ? existingEmail : new User();
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setPasswordHash(passwords.encode(request.password()));
        user.setRole(Role.TENANT);
        user.setEnabled(false);
        user.setEmailVerified(false);
        user.setTermsAcceptedAt(now);
        user.setLastVerificationSentAt(now);
        if (existingEmail != null) {
            users.save(user);
            tokenStore.invalidateVerifications(user.getId(), now);
        } else {
            users.insert(user);
        }
        sendVerification(user);
        return new MessageResponse("Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản");
    }

    @Override
    @Transactional
    public MessageResponse verifyEmail(String token) {
        var stored = verifications.findByTokenHashAndIsDeletedFalse(tokens.hash(token))
                .orElseThrow(() -> new BadRequestException("Token xác thực không hợp lệ"));
        if (!tokens.matches(token, stored.getTokenHash())) throw new BadRequestException("Token xác thực không hợp lệ");
        if (stored.getUsedAt() != null) throw new BadRequestException("Token xác thực đã được sử dụng hoặc thay thế");
        var now = clock.instant();
        if (!stored.getExpiresAt().isAfter(now)) throw new BadRequestException("Token xác thực đã hết hạn");
        if (!tokenStore.consumeVerification(stored.getTokenHash(), now)) {
            throw new BadRequestException("Token xác thực không còn hiệu lực");
        }
        var user = users.findByIdAndIsDeletedFalse(stored.getUserId())
                .orElseThrow(() -> new BadRequestException("Tài khoản không còn tồn tại"));
        user.setEmailVerified(true);
        user.setEnabled(true);
        users.save(user);
        tokenStore.invalidateVerifications(user.getId(), now);
        return new MessageResponse("Xác thực email thành công. Bạn có thể đăng nhập");
    }

    @Override
    @Transactional
    public MessageResponse resendVerification(ResendVerificationRequest request) {
        var user = users.findByEmailAndIsDeletedFalse(request.email()).orElse(null);
        if (user == null || user.isEmailVerified()) return new MessageResponse(RESEND_MESSAGE);
        var now = clock.instant();
        if (!tokenStore.claimResend(user.getId(), now.minus(properties.resendCooldown()), now)) {
            throw new TooManyRequestsException("Vui lòng chờ " + properties.resendCooldown().toSeconds()
                    + " giây giữa hai lần gửi email xác thực");
        }
        tokenStore.invalidateVerifications(user.getId(), now);
        sendVerification(user);
        return new MessageResponse(RESEND_MESSAGE);
    }

    @Override
    @Transactional
    public TokenResponse login(LoginRequest request) {
        var user = users.findByEmailAndIsDeletedFalse(request.email()).orElse(null);
        if (user == null) {
            throw new UnauthorizedException("Tài khoản không tồn tại. Vui lòng kiểm tra lại email hoặc đăng ký mới.");
        }
        String supplied = request.password();
        // BCrypt has a 72-byte input limit, including multibyte Unicode passwords.
        boolean tooLong = supplied.getBytes(StandardCharsets.UTF_8).length > 72;
        boolean matches = passwords.matches(tooLong ? "" : supplied, user.getPasswordHash());
        if (tooLong || !matches) {
            throw new UnauthorizedException("Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu.");
        }
        // Only disclose verification status after the password has been checked.
        if (!user.isEmailVerified()) {
            throw new ForbiddenException("Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.");
        }
        if (!user.isEnabled()) {
            throw new ForbiddenException("Tài khoản đã bị vô hiệu hóa hoặc tạm khóa.");
        }
        return issueTokens(user);
    }

    @Override
    @Transactional
    public TokenResponse refresh(RefreshTokenRequest request) {
        var stored = refreshTokens.findByTokenHashAndIsDeletedFalse(tokens.hash(request.refreshToken()))
                .orElseThrow(() -> new UnauthorizedException("Refresh token không hợp lệ"));
        var now = clock.instant();
        if (!tokens.matches(request.refreshToken(), stored.getTokenHash()) || stored.getRevokedAt() != null
                || !stored.getExpiresAt().isAfter(now)) {
            throw new UnauthorizedException("Refresh token đã hết hạn hoặc bị thu hồi");
        }
        var user = users.findByIdAndIsDeletedFalse(stored.getUserId())
                .orElseThrow(() -> new UnauthorizedException("Refresh token không hợp lệ"));
        if (!user.isEnabled() || !user.isEmailVerified()) throw new UnauthorizedException("Tài khoản không hoạt động");
        // Revocation and insertion commit together. Concurrent requests cannot both rotate the same token.
        if (!tokenStore.revokeRefresh(stored.getTokenHash(), now)) {
            throw new UnauthorizedException("Refresh token đã được sử dụng");
        }
        return issueTokens(user);
    }

    @Override
    @Transactional
    public MessageResponse logout(RefreshTokenRequest request) {
        tokenStore.revokeRefresh(tokens.hash(request.refreshToken()), clock.instant());
        return new MessageResponse("Đăng xuất thành công");
    }

    private void sendVerification(User user) {
        String raw = tokens.generate();
        var token = new VerificationToken();
        token.setUserId(user.getId());
        token.setTokenHash(tokens.hash(raw));
        token.setExpiresAt(clock.instant().plus(properties.verificationTokenTtl()));
        token.setPurgeAt(token.getExpiresAt().plus(Duration.ofDays(7)));
        verifications.insert(token);
        events.publishEvent(new VerificationMailEvent(user.getEmail(), raw));
    }

    private TokenResponse issueTokens(User user) {
        String raw = tokens.generate();
        var token = new RefreshToken();
        token.setUserId(user.getId());
        token.setTokenHash(tokens.hash(raw));
        token.setExpiresAt(clock.instant().plus(security.refreshTokenTtl()));
        token.setPurgeAt(token.getExpiresAt().plus(Duration.ofDays(7)));
        refreshTokens.insert(token);
        return new TokenResponse(jwt.createAccessToken(user), raw, "Bearer",
                security.accessTokenTtl().toSeconds(), security.refreshTokenTtl().toSeconds(),
                user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.getPhone());
    }

    @Override
    @Transactional
    public MessageResponse changePassword(String userId, ChangePasswordRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        User user = users.findByIdAndIsDeletedFalse(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thông tin tài khoản"));

        if (!passwords.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Mật khẩu cũ không chính xác");
        }
        if (passwords.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Mật khẩu mới không được trùng với mật khẩu cũ");
        }

        user.setPasswordHash(passwords.encode(request.newPassword()));
        users.save(user);
        return new MessageResponse("Đổi mật khẩu thành công");
    }

    @Override
    public UserProfileResponse getProfile(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        User user = users.findByIdAndIsDeletedFalse(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thông tin tài khoản"));
        return toProfileResponse(user);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(String userId, UpdateProfileRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        User user = users.findByIdAndIsDeletedFalse(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thông tin tài khoản"));

        if (request.phone() != null && !request.phone().isBlank()) {
            Optional<User> existingPhone = users.findByPhoneAndIsDeletedFalse(request.phone());
            if (existingPhone.isPresent() && !existingPhone.get().getId().equals(userId)) {
                throw new ConflictException("Số điện thoại này đã được sử dụng bởi tài khoản khác");
            }
            user.setPhone(request.phone());
        } else {
            user.setPhone(null);
        }

        user.setFullName(request.fullName().trim());
        if (request.dateOfBirth() != null) {
            user.setDateOfBirth(request.dateOfBirth());
        }
        if (request.gender() != null) {
            user.setGender(request.gender());
        }

        users.save(user);
        return toProfileResponse(user);
    }

    private UserProfileResponse toProfileResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                List.of(user.getRole().name()),
                user.getPhone(),
                user.getDateOfBirth(),
                user.getGender(),
                user.isEnabled() ? "ACTIVE" : "DISABLED"
        );
    }
}
