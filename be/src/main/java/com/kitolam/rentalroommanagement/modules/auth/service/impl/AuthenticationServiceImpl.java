package com.kitolam.rentalroommanagement.modules.auth.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.modules.auth.document.InvalidatedToken;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AuthenticationRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.IntrospectRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.LogoutRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RefreshRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RegisterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AuthenticationResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.IntrospectResponse;
import com.kitolam.rentalroommanagement.modules.auth.enums.Role;
import com.kitolam.rentalroommanagement.modules.auth.repository.InvalidatedTokenRepository;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthenticationService;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private static final String BAD_CREDENTIALS = "Email hoặc mật khẩu không đúng";
    private static final String UNAUTHENTICATED = "Token không hợp lệ hoặc đã hết hạn";

    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${jwt.signer.key}")
    protected String SIGNER_KEY;

    @Value("${jwt.valid-duration}")
    protected Long VALID_DURATION;

    @Value("${jwt.refreshable-duration}")
    protected Long REFRESHABLE_DURATION;

    private String generateToken(Tenant tenant) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
                .subject(tenant.getId())
                .issuer("rentalroommanagement.com")
                .issueTime(new Date())
                .expirationTime(new Date(Instant.now().plus(VALID_DURATION, ChronoUnit.SECONDS).toEpochMilli()))
                .claim("role", tenant.getRole() != null ? tenant.getRole().name() : Role.TENANT.name())
                .claim("email", tenant.getEmail())
                .claim("fullName", tenant.getFullName())
                .jwtID(UUID.randomUUID().toString())
                .build();
        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(header, payload);
        try {
            jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public TenantResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        String phone = request.getPhone().trim();
        String idCardNumber = request.getIdCardNumber().trim();

        if (tenantRepository.existsByEmailAndIsDeletedFalse(email)) {
            throw new ConflictException("Email đã được sử dụng");
        }
        if (tenantRepository.existsByPhoneAndIsDeletedFalse(phone)) {
            throw new ConflictException("Số điện thoại đã được sử dụng");
        }
        if (tenantRepository.existsByIdCardNumberAndIsDeletedFalse(idCardNumber)) {
            throw new ConflictException("Số CCCD/CMND đã được sử dụng");
        }

        Tenant tenant = new Tenant();
        tenant.setFullName(request.getFullName().trim());
        tenant.setEmail(email);
        tenant.setPhone(phone);
        tenant.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        tenant.setDateOfBirth(request.getDateOfBirth());
        tenant.setGender(request.getGender());
        tenant.setIdCardNumber(idCardNumber);
        tenant.setAddress(request.getAddress().trim());
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.setRole(Role.TENANT);

        return toTenantResponse(tenantRepository.save(tenant));
    }

    @Override
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        var tenant = tenantRepository.findByEmailAndIsDeletedFalse(normalizeEmail(request.getEmail()))
                .orElseThrow(() -> new UnauthorizedException(BAD_CREDENTIALS));
        boolean authenticated = tenant.getPasswordHash() != null
                && passwordEncoder.matches(request.getPassword(), tenant.getPasswordHash());
        if (!authenticated) {
            throw new UnauthorizedException(BAD_CREDENTIALS);
        }
        ensureActive(tenant);
        var token = generateToken(tenant);
        return AuthenticationResponse.builder()
                .token(token)
                .expiresIn(VALID_DURATION)
                .authenticated(true)
                .build();
    }

    @Override
    public void logout(LogoutRequest request) throws ParseException, JOSEException {
        try {
            var signToken = verifyToken(request.getToken(), true);
            String jit = signToken.getJWTClaimsSet().getJWTID();
            Date expirationTime = signToken.getJWTClaimsSet().getExpirationTime();

            invalidatedTokenRepository.save(new InvalidatedToken(jit, expirationTime));
        } catch (UnauthorizedException e) {
            log.info("Token already expired");
        }
    }

    private SignedJWT verifyToken(String token, boolean isRefresh) throws ParseException, JOSEException {
        JWSVerifier verifier = new MACVerifier(SIGNER_KEY.getBytes());

        SignedJWT signedJWT;
        try {
            signedJWT = SignedJWT.parse(token);
        } catch (ParseException e) {
            throw new UnauthorizedException(UNAUTHENTICATED);
        }

        JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
        if (claims.getIssueTime() == null || claims.getExpirationTime() == null || claims.getJWTID() == null) {
            throw new UnauthorizedException(UNAUTHENTICATED);
        }

        Date expiryTime = (isRefresh)
                ? new Date(claims.getIssueTime()
                .toInstant().plus(REFRESHABLE_DURATION, ChronoUnit.SECONDS).toEpochMilli())
                : claims.getExpirationTime();

        var verified = signedJWT.verify(verifier);

        if (!(verified && expiryTime.after(new Date()))) {
            throw new UnauthorizedException(UNAUTHENTICATED);
        }

        if (invalidatedTokenRepository.existsById(claims.getJWTID())) {
            throw new UnauthorizedException(UNAUTHENTICATED);
        }

        return signedJWT;
    }

    @Override
    public IntrospectResponse introspect(IntrospectRequest request)
            throws JOSEException, ParseException {
        var token = request.getToken();
        boolean isValid = true;
        try {
            verifyToken(token, false);
        } catch (UnauthorizedException e) {
            isValid = false;
        }
        return IntrospectResponse.builder()
                .valid(isValid)
                .build();
    }

    @Override
    public AuthenticationResponse refreshToken(RefreshRequest request) throws ParseException, JOSEException {
        var signJWT = verifyToken(request.getToken(), true);

        var jit = signJWT.getJWTClaimsSet().getJWTID();
        var expirationTime = signJWT.getJWTClaimsSet().getExpirationTime();

        invalidatedTokenRepository.save(new InvalidatedToken(jit, expirationTime));

        var tenantId = signJWT.getJWTClaimsSet().getSubject();
        var tenant = tenantRepository.findByIdAndIsDeletedFalse(tenantId)
                .orElseThrow(() -> new UnauthorizedException("Tài khoản không tồn tại"));
        ensureActive(tenant);
        var token = generateToken(tenant);
        return AuthenticationResponse.builder()
                .token(token)
                .expiresIn(VALID_DURATION)
                .authenticated(true)
                .build();
    }

    private void ensureActive(Tenant tenant) {
        if (tenant.getStatus() != null && tenant.getStatus() != TenantStatus.ACTIVE) {
            throw new ForbiddenException("Tài khoản đã bị khoá hoặc ngừng hoạt động");
        }
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static TenantResponse toTenantResponse(Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getFullName(),
                tenant.getEmail(),
                tenant.getPhone(),
                tenant.getDateOfBirth(),
                tenant.getGender(),
                tenant.getIdCardNumber(),
                tenant.getAddress(),
                tenant.getAvatarUrl(),
                tenant.getStatus(),
                tenant.getCreatedAt(),
                tenant.getUpdatedAt()
        );
    }
}
