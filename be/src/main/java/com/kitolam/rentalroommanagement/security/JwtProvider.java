package com.kitolam.rentalroommanagement.security;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Component
public class JwtProvider {
    private final SecurityProperties properties;
    private final Clock clock;
    private final JwtEncoder encoder;
    private final NimbusJwtDecoder decoder;

    public JwtProvider(SecurityProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        byte[] key;
        try {
            key = Base64.getDecoder().decode(properties.jwtSecret());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("JWT_SECRET phải là Base64 hợp lệ");
        }
        if (key.length < 32) throw new IllegalStateException("JWT_SECRET cần ít nhất 32 byte ngẫu nhiên");
        var secretKey = new SecretKeySpec(key, "HmacSHA256");
        encoder = new NimbusJwtEncoder(new ImmutableSecret<>(secretKey));
        decoder = NimbusJwtDecoder.withSecretKey(secretKey).macAlgorithm(MacAlgorithm.HS256).build();
        var timestamps = new JwtTimestampValidator(Duration.ZERO);
        timestamps.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestamps, new JwtIssuerValidator(properties.issuer()), jwt -> {
                    boolean valid = jwt.getExpiresAt() != null && jwt.getIssuedAt() != null
                            && !jwt.getIssuedAt().isAfter(clock.instant())
                            && jwt.getAudience() != null && jwt.getAudience().contains(properties.audience())
                            && jwt.getSubject() != null && jwt.getSubject().matches("[0-9a-f]{24}")
                            && jwt.getSubject().equals(jwt.getClaimAsString("userId"))
                            && jwt.getClaimAsString("email") != null
                            && jwt.getClaimAsString("role") != null
                            && List.of("TENANT", "MANAGER", "ADMIN").contains(jwt.getClaimAsString("role"));
                    return valid ? OAuth2TokenValidatorResult.success() :
                            OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
                }));
    }

    public String createAccessToken(User user) {
        var now = clock.instant();
        var claims = JwtClaimsSet.builder().issuer(properties.issuer())
                .audience(List.of(properties.audience())).subject(user.getId())
                .id(UUID.randomUUID().toString()).issuedAt(now)
                .expiresAt(now.plus(properties.accessTokenTtl()))
                .claim("userId", user.getId()).claim("email", user.getEmail())
                .claim("role", user.getRole().name()).build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), claims)).getTokenValue();
    }

    public Jwt decode(String token) { return decoder.decode(token); }
}
