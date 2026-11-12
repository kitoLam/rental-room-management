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
    public AdminAccountStatistics readStatisticsForAdmin(int year) {
        var zone = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        var from = java.time.LocalDate.of(year, 1, 1).atStartOfDay(zone).toInstant();
        var to = java.time.LocalDate.of(year + 1, 1, 1).atStartOfDay(zone).toInstant();
        long total = 0, active = 0, unverified = 0, inactive = 0;
        var roles = new java.util.TreeMap<String, Long>();
        for (var group : users.readAccountGroups()) {
            total += group.count();
            roles.merge(group.role() == null ? "UNKNOWN" : group.role(), group.count(), Long::sum);
            if (!Boolean.TRUE.equals(group.emailVerified())) unverified += group.count();
            else if (Boolean.TRUE.equals(group.enabled())) active += group.count();
            else inactive += group.count();
        }
        var recent = users.readRecentForAdmin(org.springframework.data.domain.PageRequest.of(0, 3,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt", "_id")))
                .stream().map(u -> new AdminAccountStatistics.RecentAccount(u.getId(), u.getFullName(),
                        u.getRole() == null ? "UNKNOWN" : u.getRole().name(), u.getCreatedAt())).toList();
        return new AdminAccountStatistics(total, active, unverified, inactive,
                roles.entrySet().stream().map(e -> new AdminAccountStatistics.RoleCount(e.getKey(), e.getValue())).toList(),
                users.readRegistrations(from, to), recent);
    }

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
        sendVerification(user, false, null);
        return new MessageResponse("Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản");
    }

    @Override
    @Transactional
    public AccountIdentityResponse createManagedTenantAccount(String fullName, String email, String phone, String branchName) {
        String normalizedEmail = email == null ? null : email.strip().toLowerCase(java.util.Locale.ROOT);
        String normalizedPhone = phone == null ? null : phone.strip();
        if (normalizedPhone != null && normalizedPhone.startsWith("+84")) {
            normalizedPhone = "0" + normalizedPhone.substring(3);
        }
        if (users.findByEmailAndIsDeletedFalse(normalizedEmail).isPresent() || users.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email này đã tồn tại tài khoản trong hệ thống");
        }
        if (normalizedPhone != null && !normalizedPhone.isBlank()
                && (users.findByPhoneAndIsDeletedFalse(normalizedPhone).isPresent() || users.existsByPhone(normalizedPhone))) {
            throw new ConflictException("Số điện thoại này đã tồn tại tài khoản trong hệ thống");
        }
        var now = clock.instant();
        User user = new User();
        user.setFullName(fullName == null ? null : fullName.strip());
        user.setEmail(normalizedEmail);
        user.setPhone(normalizedPhone);
        user.setPasswordHash(null);
        user.setRole(Role.TENANT);
        user.setEnabled(false);
        user.setEmailVerified(false);
        user.setLastVerificationSentAt(now);
        users.insert(user);
        sendVerification(user, true, branchName);
        return identity(user);
    }

    @Override
    @Transactional
    public MessageResponse resendManagedTenantVerification(String email, String branchName) {
        String normalizedEmail = email == null ? null : email.strip().toLowerCase(java.util.Locale.ROOT);
        var user = users.findByEmailAndIsDeletedFalse(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài khoản tương ứng với email này"));
        if (user.isEnabled() && user.isEmailVerified() && user.getPasswordHash() != null && !user.getPasswordHash().isBlank()) {
            throw new ConflictException("Tài khoản này đã được xác thực và kích hoạt");
        }
        var now = clock.instant();
        if (!tokenStore.claimResend(user.getId(), now.minus(properties.resendCooldown()), now)) {
            throw new TooManyRequestsException("Vui lòng chờ " + properties.resendCooldown().toSeconds()
                    + " giây giữa hai lần gửi email xác thực");
        }
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            user.setEmailVerified(false);
            users.save(user);
        }
        tokenStore.invalidateVerifications(user.getId(), now);
        sendVerification(user, true, branchName);
        return new MessageResponse("Đã gửi lại liên kết xác thực và đặt mật khẩu tới email của người thuê");
    }

    @Override
    @Transactional
    public MessageResponse verifyEmail(String token) {
        var stored = verifications.findByTokenHashAndIsDeletedFalse(tokens.hash(token))
                .orElseThrow(() -> new BadRequestException("Token xác thực không hợp lệ"));
        if (!tokens.matches(token, stored.getTokenHash())) throw new BadRequestException("Token xác thực không hợp lệ");
        if (stored.getPurpose() != null && stored.getPurpose() != TokenPurpose.EMAIL_VERIFICATION) {
            throw new BadRequestException("Token xác thực không hợp lệ");
        }
        if (stored.getUsedAt() != null) throw new BadRequestException("Token xác thực đã được sử dụng hoặc thay thế");
        var now = clock.instant();
        if (!stored.getExpiresAt().isAfter(now)) throw new BadRequestException("Token xác thực đã hết hạn");
        if (!tokenStore.consumeVerification(stored.getTokenHash(), TokenPurpose.EMAIL_VERIFICATION, now)) {
            throw new BadRequestException("Token xác thực không còn hiệu lực");
        }
        var user = users.findByIdAndIsDeletedFalse(stored.getUserId())
                .orElseThrow(() -> new BadRequestException("Tài khoản không còn tồn tại"));
        user.setEmailVerified(true);
        tokenStore.invalidateVerifications(user.getId(), now);
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            user.setEnabled(false);
            users.save(user);
            String setupToken = issuePasswordSetupToken(user);
            return new MessageResponse(
                    "Xác thực email thành công. Vui lòng đặt mật khẩu để hoàn tất kích hoạt tài khoản",
                    true,
                    setupToken);
        }
        user.setEnabled(true);
        users.save(user);
        return new MessageResponse("Xác thực email thành công. Bạn có thể đăng nhập");
    }

    @Override
    @Transactional
    public MessageResponse setupPassword(SetupPasswordRequest request) {
        var stored = verifications.findByTokenHashAndIsDeletedFalse(tokens.hash(request.token()))
                .orElseThrow(() -> new BadRequestException("Liên kết đặt mật khẩu không hợp lệ"));
        if (!tokens.matches(request.token(), stored.getTokenHash())
                || stored.getPurpose() != TokenPurpose.PASSWORD_SETUP) {
            throw new BadRequestException("Liên kết đặt mật khẩu không hợp lệ");
        }
        if (stored.getUsedAt() != null) {
            throw new BadRequestException("Liên kết đặt mật khẩu đã được sử dụng hoặc thay thế");
        }
        var now = clock.instant();
        if (!stored.getExpiresAt().isAfter(now)) {
            throw new BadRequestException("Liên kết đặt mật khẩu đã hết hạn");
        }
        var user = users.findByIdAndIsDeletedFalse(stored.getUserId())
                .orElseThrow(() -> new BadRequestException("Tài khoản không còn tồn tại"));
        if (!user.isEmailVerified()) {
            throw new BadRequestException("Tài khoản chưa được xác thực email. Vui lòng xác thực email trước khi đặt mật khẩu");
        }
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException("Mật khẩu không được vượt quá 72 byte");
        }
        if (!tokenStore.consumeVerification(stored.getTokenHash(), TokenPurpose.PASSWORD_SETUP, now)) {
            throw new BadRequestException("Liên kết đặt mật khẩu không còn hiệu lực");
        }
        user.setPasswordHash(passwords.encode(request.password()));
        user.setEnabled(true);
        if (user.getTermsAcceptedAt() == null) {
            user.setTermsAcceptedAt(now);
        }
        users.save(user);
        tokenStore.invalidateVerifications(user.getId(), now);
        return new MessageResponse("Đặt mật khẩu thành công. Bạn có thể đăng nhập");
    }

    @Override
    @Transactional
    public MessageResponse resendVerification(ResendVerificationRequest request) {
        var user = users.findByEmailAndIsDeletedFalse(request.email()).orElse(null);
        boolean needsPasswordSetup = user != null && (user.getPasswordHash() == null || user.getPasswordHash().isBlank());
        if (user == null || (user.isEmailVerified() && !needsPasswordSetup)) {
            return new MessageResponse(RESEND_MESSAGE);
        }
        var now = clock.instant();
        if (!tokenStore.claimResend(user.getId(), now.minus(properties.resendCooldown()), now)) {
            throw new TooManyRequestsException("Vui lòng chờ " + properties.resendCooldown().toSeconds()
                    + " giây giữa hai lần gửi email xác thực");
        }
        if (needsPasswordSetup && user.isEmailVerified()) {
            user.setEmailVerified(false);
            users.save(user);
        }
        tokenStore.invalidateVerifications(user.getId(), now);
        sendVerification(user, needsPasswordSetup, null);
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
        boolean missingPassword = user.getPasswordHash() == null || user.getPasswordHash().isBlank();
        String hashToCheck = missingPassword ? dummyPasswordHash : user.getPasswordHash();
        boolean matches = passwords.matches(tooLong ? "" : supplied, hashToCheck);
        if (missingPassword) {
            throw new ForbiddenException("Tài khoản chưa hoàn tất xác thực email và đặt mật khẩu. Vui lòng kiểm tra hộp thư email.");
        }
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

    private void sendVerification(User user, boolean createdByManager, String branchName) {
        String raw = tokens.generate();
        var token = new VerificationToken();
        token.setUserId(user.getId());
        token.setPurpose(TokenPurpose.EMAIL_VERIFICATION);
        token.setTokenHash(tokens.hash(raw));
        token.setExpiresAt(clock.instant().plus(properties.verificationTokenTtl()));
        token.setPurgeAt(token.getExpiresAt().plus(Duration.ofDays(7)));
        verifications.insert(token);
        events.publishEvent(new VerificationMailEvent(user.getEmail(), raw, createdByManager, branchName));
    }

    private String issuePasswordSetupToken(User user) {
        String raw = tokens.generate();
        var token = new VerificationToken();
        token.setUserId(user.getId());
        token.setPurpose(TokenPurpose.PASSWORD_SETUP);
        token.setTokenHash(tokens.hash(raw));
        token.setExpiresAt(clock.instant().plus(properties.verificationTokenTtl()));
        token.setPurgeAt(token.getExpiresAt().plus(Duration.ofDays(7)));
        verifications.insert(token);
        return raw;
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
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new BadRequestException("Tài khoản chưa được thiết lập mật khẩu");
        }

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
