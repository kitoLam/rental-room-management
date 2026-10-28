package com.kitolam.rentalroommanagement.modules.auth.config;

import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "app.seed.auth.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AuthDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @org.springframework.beans.factory.annotation.Value("${AUTH_SEED_PASSWORD:}")
    private String seedPassword;

    private record SeedUser(String email, String fullName, String phone, Role role, String rawPassword) {}

    @Override
    public void run(String... args) {
        if (seedPassword.isBlank()) throw new IllegalStateException("Cần cấu hình AUTH_SEED_PASSWORD khi chủ động bật seed tài khoản");
        List<SeedUser> seedUsers = List.of(
                new SeedUser("admin@tropro.com", "Quản Trị Viên", "0901000001", Role.ADMIN, seedPassword),
                new SeedUser("manager@tropro.com", "Quản Lý Tòa Nhà", "0901000002", Role.MANAGER, seedPassword),
                new SeedUser("owner@tropro.com", "Chủ Nhà Trọ", "0901000003", Role.OWNER, seedPassword),
                new SeedUser("tenant@tropro.com", "Khách Thuê Trọ", "0901000004", Role.TENANT, seedPassword)
        );

        for (SeedUser seed : seedUsers) {
            userRepository.findByEmailAndIsDeletedFalse(seed.email())
                    .ifPresentOrElse(
                            existing -> {
                                existing.setFullName(seed.fullName());
                                existing.setRole(seed.role());
                                existing.setEnabled(true);
                                existing.setEmailVerified(true);
                                existing.setPasswordHash(passwordEncoder.encode(seed.rawPassword()));
                                userRepository.save(existing);
                                log.info("Tài khoản mẫu [{}] đã được đồng bộ / kích hoạt thành công (Role: {}).", seed.email(), seed.role());
                            },
                            () -> {
                                User newUser = new User();
                                newUser.setEmail(seed.email());
                                newUser.setFullName(seed.fullName());
                                String phone = seed.phone();
                                if (userRepository.existsByPhone(phone)) {
                                    phone = "090" + (System.currentTimeMillis() % 10000000);
                                }
                                newUser.setPhone(phone);
                                newUser.setRole(seed.role());
                                newUser.setPasswordHash(passwordEncoder.encode(seed.rawPassword()));
                                newUser.setEnabled(true);
                                newUser.setEmailVerified(true);
                                newUser.setTermsAcceptedAt(Instant.now());
                                userRepository.save(newUser);
                                log.info("Đã khởi tạo tài khoản mẫu [{}] thành công (Role: {}).", seed.email(), seed.role());
                            }
                    );
        }
    }
}
