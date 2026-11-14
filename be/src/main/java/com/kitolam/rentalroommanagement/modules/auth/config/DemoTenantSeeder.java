package com.kitolam.rentalroommanagement.modules.auth.config;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Extra demo tenant account (tenant2@tropro.com) using AUTH_SEED_PASSWORD. Opt-in via DEMO_TENANT_SEED_ENABLED;
 * only creates the account when missing, never touches existing users.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.seed.demo-tenant.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DemoTenantSeeder implements CommandLineRunner {

    static final String EMAIL = "tenant2@tropro.com";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${AUTH_SEED_PASSWORD:}")
    private String seedPassword;

    @Override
    public void run(String... args) {
        if (seedPassword.isBlank()) throw new IllegalStateException("Cần cấu hình AUTH_SEED_PASSWORD để tạo tài khoản mẫu");
        if (userRepository.findByEmailAndIsDeletedFalse(EMAIL).isPresent()) {
            log.info("Demo tenant [{}] already exists, skipped", EMAIL);
            return;
        }
        User user = new User();
        user.setEmail(EMAIL);
        user.setFullName("Khách Thuê Demo 2");
        user.setPhone(userRepository.existsByPhone("0901000005") ? "090" + (System.currentTimeMillis() % 10_000_000) : "0901000005");
        user.setRole(Role.TENANT);
        user.setPasswordHash(passwordEncoder.encode(seedPassword));
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setTermsAcceptedAt(Instant.now());
        userRepository.save(user);
        log.info("Created demo tenant [{}]", EMAIL);
    }
}
