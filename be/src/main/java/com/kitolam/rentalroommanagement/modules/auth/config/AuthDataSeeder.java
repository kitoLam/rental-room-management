package com.kitolam.rentalroommanagement.modules.auth.config;

import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private record SeedUser(String email, String fullName, String phone, Role role, String rawPassword) {}

    @Override
    public void run(String... args) {
        List<SeedUser> seedUsers = List.of(
                new SeedUser("admin@tropro.com", "Quản Trị Viên", "0901000001", Role.ADMIN, "TroPro@123"),
                new SeedUser("manager@tropro.com", "Quản Lý Tòa Nhà", "0901000002", Role.MANAGER, "TroPro@123"),
                new SeedUser("owner@tropro.com", "Chủ Nhà Trọ", "0901000003", Role.OWNER, "TroPro@123"),
                new SeedUser("tenant@tropro.com", "Khách Thuê Trọ", "0901000004", Role.TENANT, "TroPro@123")
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
