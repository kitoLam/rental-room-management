package com.kitolam.rentalroommanagement.modules.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.security.JwtProvider;
import com.kitolam.rentalroommanagement.common.security.SecurityProperties;
import com.kitolam.rentalroommanagement.modules.auth.config.AuthProperties;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.TokenPurpose;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.document.VerificationToken;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.SetupPasswordRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.MessageResponse;
import com.kitolam.rentalroommanagement.modules.auth.repository.AuthTokenStore;
import com.kitolam.rentalroommanagement.modules.auth.repository.RefreshTokenRepository;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.auth.repository.VerificationTokenRepository;
import com.kitolam.rentalroommanagement.modules.auth.service.VerificationMailEvent;
import com.kitolam.rentalroommanagement.modules.auth.service.impl.AuthServiceImpl;
import com.kitolam.rentalroommanagement.modules.auth.util.OpaqueTokenProvider;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantBranchStatusRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantBranchStatsResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import com.kitolam.rentalroommanagement.modules.tenant.mapper.TenantMapper;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.kitolam.rentalroommanagement.modules.tenant.service.impl.TenantServiceImpl;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class TenantManagementServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-11T09:00:00Z");
    private static final String BRANCH_1 = "664f00000000000000000001";
    private static final String BRANCH_2 = "664f00000000000000000002";
    private static final String OTHER_BRANCH = "664f00000000000000000099";

    private UserRepository userRepository;
    private VerificationTokenRepository verificationRepository;
    private AuthTokenStore tokenStore;
    private ApplicationEventPublisher eventPublisher;
    private OpaqueTokenProvider tokenProvider;
    private AuthServiceImpl authService;

    private TenantRepository tenantRepository;
    private ManagerRepository managerRepository;
    private BranchService branchService;
    private RoomRepository roomRepository;
    private ContractRepository contractRepository;
    private ContractTenantRepository contractTenantRepository;
    private TenantServiceImpl tenantService;

    private final Map<String, User> usersByEmail = new HashMap<>();
    private final Map<String, User> usersById = new HashMap<>();
    private final Map<String, VerificationToken> tokensByHash = new HashMap<>();
    private final List<Tenant> savedTenants = new ArrayList<>();
    private final List<Manager> savedManagers = new ArrayList<>();

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        verificationRepository = mock(VerificationTokenRepository.class);
        RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
        tokenStore = mock(AuthTokenStore.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        tokenProvider = new OpaqueTokenProvider();
        var passwordEncoder = new BCryptPasswordEncoder(4);
        String secret = Base64.getEncoder().encodeToString(new byte[32]);
        var securityProps = new SecurityProperties(
                secret, "tropro", "tropro-web", Duration.ofMinutes(15), Duration.ofDays(7),
                List.of("http://localhost:5173"), false, true, 10);
        var authProps = new AuthProperties("http://localhost:5173", "no-reply@tropro.com", Duration.ofHours(24), Duration.ofSeconds(60));
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        var jwtProvider = new JwtProvider(securityProps, clock);

        authService = new AuthServiceImpl(
                userRepository,
                verificationRepository,
                refreshTokenRepository,
                tokenStore,
                passwordEncoder,
                tokenProvider,
                jwtProvider,
                securityProps,
                authProps,
                eventPublisher,
                clock
        );

        when(userRepository.insert(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId("664f1000000000000000000" + (usersById.size() + 1));
            usersByEmail.put(u.getEmail(), u);
            usersById.put(u.getId(), u);
            return u;
        });
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            usersByEmail.put(u.getEmail(), u);
            usersById.put(u.getId(), u);
            return u;
        });
        when(userRepository.findByEmailAndIsDeletedFalse(any())).thenAnswer(inv ->
                Optional.ofNullable(usersByEmail.get(inv.getArgument(0))));
        when(userRepository.findByIdAndIsDeletedFalse(any())).thenAnswer(inv ->
                Optional.ofNullable(usersById.get(inv.getArgument(0))));
        when(verificationRepository.insert(any(VerificationToken.class))).thenAnswer(inv -> {
            VerificationToken vt = inv.getArgument(0);
            tokensByHash.put(vt.getTokenHash(), vt);
            return vt;
        });
        when(verificationRepository.findByTokenHashAndIsDeletedFalse(any())).thenAnswer(inv ->
                Optional.ofNullable(tokensByHash.get(inv.getArgument(0))));

        tenantRepository = mock(TenantRepository.class);
        managerRepository = mock(ManagerRepository.class);
        branchService = mock(BranchService.class);
        roomRepository = mock(RoomRepository.class);
        contractRepository = mock(ContractRepository.class);
        contractTenantRepository = mock(ContractTenantRepository.class);

        when(roomRepository.findByBranchIdInAndIsDeletedFalse(any())).thenReturn(List.of());
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> {
            Tenant t = inv.getArgument(0);
            if (t.getId() == null) {
                t.setId("664f2000000000000000000" + (savedTenants.size() + 1));
                savedTenants.add(t);
            }
            return t;
        });
        when(tenantRepository.findByIsDeletedFalse()).thenAnswer(inv ->
                savedTenants.stream().filter(t -> !Boolean.TRUE.equals(t.getIsDeleted())).toList());
        when(tenantRepository.findByIdAndIsDeletedFalse(any())).thenAnswer(inv -> {
            String id = inv.getArgument(0);
            return savedTenants.stream()
                    .filter(t -> !Boolean.TRUE.equals(t.getIsDeleted()) && id.equals(t.getId()))
                    .findFirst();
        });
        when(tenantRepository.findByEmailAndIsDeletedFalse(any())).thenAnswer(inv -> {
            String email = inv.getArgument(0);
            return savedTenants.stream()
                    .filter(t -> !Boolean.TRUE.equals(t.getIsDeleted()) && email.equals(t.getEmail()))
                    .findFirst();
        });
        when(tenantRepository.findByPhoneAndIsDeletedFalse(any())).thenAnswer(inv -> {
            String phone = inv.getArgument(0);
            return savedTenants.stream()
                    .filter(t -> !Boolean.TRUE.equals(t.getIsDeleted()) && phone.equals(t.getPhone()))
                    .findFirst();
        });

        when(managerRepository.save(any(Manager.class))).thenAnswer(inv -> {
            Manager m = inv.getArgument(0);
            if (m.getId() == null) {
                m.setId("664f3000000000000000000" + (savedManagers.size() + 1));
                savedManagers.add(m);
            }
            return m;
        });
        when(managerRepository.findByBranchIdInAndIsDeletedFalse(any())).thenAnswer(inv -> {
            java.util.Collection<String> branchIds = inv.getArgument(0);
            return savedManagers.stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getIsDeleted()) && branchIds.contains(m.getBranchId()))
                    .toList();
        });
        when(managerRepository.findByIdAndIsDeletedFalse(any())).thenAnswer(inv -> {
            String id = inv.getArgument(0);
            return savedManagers.stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getIsDeleted()) && id.equals(m.getId()))
                    .findFirst();
        });
        when(managerRepository.findByEmailAndIsDeletedFalse(any())).thenAnswer(inv -> {
            String email = inv.getArgument(0);
            return savedManagers.stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getIsDeleted()) && email.equals(m.getEmail()))
                    .findFirst();
        });

        TenantMapper mapper = new TenantMapper() {};
        tenantService = new TenantServiceImpl(
                mock(org.springframework.data.mongodb.core.MongoTemplate.class),
                tenantRepository,
                managerRepository,
                userRepository,
                authService,
                branchService,
                roomRepository,
                contractRepository,
                contractTenantRepository,
                mapper
        );
    }

    private BranchResponse branch(String id, String ownerId, String name) {
        return new BranchResponse(
                id, name, "Hà Nội", "0900000000", "b@tropro.com",
                "", BranchStatus.ACTIVE, NOW, NOW, ownerId, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO
        );
    }

    @Test
    void managerCreatesTenantAccountThenTenantVerifiesEmailBeforeSettingPassword() {
        AuthPrincipal manager = new AuthPrincipal("mgr-1", "manager@tropro.com", "MANAGER");
        when(branchService.managedBranches(manager)).thenReturn(List.of(branch(BRANCH_1, "owner-1", "Cơ sở Cầu Giấy")));

        TenantCreateRequest createReq = new TenantCreateRequest(
                " Nguyễn Văn An ", "AN@GMAIL.COM", "+84912345678", null, null, Gender.MALE, null
        );
        TenantResponse created = tenantService.create(createReq, manager);

        assertThat(created.fullName()).isEqualTo("Nguyễn Văn An");
        assertThat(created.email()).isEqualTo("an@gmail.com");
        assertThat(created.phone()).isEqualTo("0912345678");
        assertThat(created.emailVerified()).isFalse();
        assertThat(created.passwordSet()).isFalse();
        assertThat(created.accountStatus()).isEqualTo("PENDING_VERIFICATION");
        assertThat(created.branchIds()).containsExactly(BRANCH_1);

        // User is stored without password; manager never knows password
        User storedUser = usersByEmail.get("an@gmail.com");
        assertThat(storedUser).isNotNull();
        assertThat(storedUser.getRole()).isEqualTo(Role.TENANT);
        assertThat(storedUser.getPasswordHash()).isNull();
        assertThat(storedUser.isEnabled()).isFalse();
        assertThat(storedUser.isEmailVerified()).isFalse();

        // Capture verification email event
        ArgumentCaptor<VerificationMailEvent> mailCaptor = ArgumentCaptor.forClass(VerificationMailEvent.class);
        verify(eventPublisher).publishEvent(mailCaptor.capture());
        VerificationMailEvent mailEvent = mailCaptor.getValue();
        assertThat(mailEvent.email()).isEqualTo("an@gmail.com");
        assertThat(mailEvent.createdByManager()).isTrue();
        assertThat(mailEvent.branchName()).isEqualTo("Cơ sở Cầu Giấy");

        // Step 1: Tenant clicks link in Gmail to verify email first
        when(tokenStore.consumeVerification(
                eq(tokenProvider.hash(mailEvent.token())),
                eq(TokenPurpose.EMAIL_VERIFICATION),
                any())).thenReturn(true);

        MessageResponse verifyRes = authService.verifyEmail(mailEvent.token());
        assertThat(verifyRes.requiresPasswordSetup()).isTrue();
        assertThat(verifyRes.setupToken()).isNotBlank();
        assertThat(storedUser.isEmailVerified()).isTrue();
        assertThat(storedUser.isEnabled()).isFalse(); // Still disabled until password is set

        // Step 2: Tenant sets their own password using the setupToken
        String setupToken = verifyRes.setupToken();
        when(tokenStore.consumeVerification(
                eq(tokenProvider.hash(setupToken)),
                eq(TokenPurpose.PASSWORD_SETUP),
                any())).thenReturn(true);

        MessageResponse setupRes = authService.setupPassword(
                new SetupPasswordRequest(setupToken, "Tenant@12345", "Tenant@12345")
        );
        assertThat(setupRes.message()).contains("Đặt mật khẩu thành công");
        assertThat(storedUser.isEnabled()).isTrue();
        assertThat(storedUser.getPasswordHash()).startsWith("$2");
    }

    @Test
    void rejectsDuplicateEmailWhenCreatingTenant() {
        AuthPrincipal manager = new AuthPrincipal("mgr-1", "manager@tropro.com", "MANAGER");
        when(branchService.managedBranches(manager)).thenReturn(List.of(branch(BRANCH_1, "owner-1", "Cơ sở 1")));

        TenantCreateRequest req = new TenantCreateRequest(
                "Nguyễn Văn A", "dup@gmail.com", "0912345678", null, null, null, null
        );
        tenantService.create(req, manager);

        TenantCreateRequest duplicateReq = new TenantCreateRequest(
                "Người Khác", "DUP@gmail.com", "0987654321", null, null, null, null
        );
        assertThatThrownBy(() -> tenantService.create(duplicateReq, manager))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Email này đã tồn tại tài khoản");
    }

    @Test
    void branchLevelInactiveOnlyAffectsManagedBranchAndOwnerManagesAllOwnedBranches() {
        AuthPrincipal manager1 = new AuthPrincipal("mgr-1", "mgr1@tropro.com", "MANAGER");
        AuthPrincipal owner = new AuthPrincipal("owner-1", "owner@tropro.com", "OWNER");

        when(branchService.managedBranches(manager1)).thenReturn(List.of(branch(BRANCH_1, "owner-1", "Cơ sở 1")));
        when(branchService.managedBranches(owner)).thenReturn(List.of(
                branch(BRANCH_1, "owner-1", "Cơ sở 1"),
                branch(BRANCH_2, "owner-1", "Cơ sở 2")
        ));

        // Manager creates tenant in Branch 1
        TenantResponse t1 = tenantService.create(
                new TenantCreateRequest("Trần Thị B", "b@gmail.com", "0911222333", null, null, Gender.FEMALE, null),
                manager1
        );
        // Owner creates tenant in Branch 2
        TenantResponse t2 = tenantService.create(
                new TenantCreateRequest("Lê Văn C", "c@gmail.com", "0922333444", BRANCH_2, null, Gender.MALE, null),
                owner
        );

        // Manager cannot operate on Branch 2
        assertThatThrownBy(() -> tenantService.create(
                new TenantCreateRequest("X", "x@gmail.com", "0933444555", BRANCH_2, null, null, null),
                manager1
        )).isInstanceOf(ForbiddenException.class);

        // Manager sees 1 tenant in Branch 1; Owner sees 2 tenants across both owned branches
        TenantBranchStatsResponse mgrStats = tenantService.stats(null, manager1);
        assertThat(mgrStats.totalTenants()).isEqualTo(1);

        TenantBranchStatsResponse ownerStats = tenantService.stats(null, owner);
        assertThat(ownerStats.totalTenants()).isEqualTo(2);

        // Also associate t1 with Branch 2 and then Manager 1 inactivates t1 in Branch 1
        savedTenants.getFirst().addBranch(BRANCH_2);
        TenantResponse inactivated = tenantService.updateBranchStatus(
                t1.id(),
                new TenantBranchStatusRequest(BRANCH_1, TenantStatus.INACTIVE),
                manager1
        );
        assertThat(inactivated.status()).isEqualTo(TenantStatus.INACTIVE);

        // In Branch 2, t1 is STILL ACTIVE (inactive is branch-scoped only!)
        var branch2Tenants = tenantService.search(
                new TenantFilterRequest(BRANCH_2, null, null, null),
                PageRequest.of(0, 10),
                owner
        );
        TenantResponse t1InBranch2 = branch2Tenants.getContent().stream()
                .filter(item -> item.id().equals(t1.id()))
                .findFirst()
                .orElseThrow();
        assertThat(t1InBranch2.status()).isEqualTo(TenantStatus.ACTIVE);
        assertThat(t2.branchIds()).containsExactly(BRANCH_2);
    }

    @Test
    void ownerCanFilterAndPromoteDemoteRolesWhileManagerOnlySeesTenantsAndSearchesByName() {
        AuthPrincipal manager1 = new AuthPrincipal("mgr-1", "mgr1@tropro.com", "MANAGER");
        AuthPrincipal owner = new AuthPrincipal("owner-1", "owner@tropro.com", "OWNER");

        when(branchService.managedBranches(manager1)).thenReturn(List.of(branch(BRANCH_1, "owner-1", "Cơ sở 1")));
        when(branchService.managedBranches(owner)).thenReturn(List.of(
                branch(BRANCH_1, "owner-1", "Cơ sở 1"),
                branch(BRANCH_2, "owner-1", "Cơ sở 2")
        ));

        TenantResponse tenant = tenantService.create(
                new TenantCreateRequest("Phạm Minh Đức", "duc@gmail.com", "0944555666", BRANCH_1, null, Gender.MALE, null),
                owner
        );
        assertThat(tenant.role()).isEqualTo("TENANT");

        // Manager cannot promote/demote roles
        assertThatThrownBy(() -> tenantService.updateRole(
                tenant.id(),
                new TenantRoleUpdateRequest("MANAGER", BRANCH_1),
                manager1
        )).isInstanceOf(ForbiddenException.class);

        // Owner promotes TENANT -> MANAGER in BRANCH_1
        TenantResponse promoted = tenantService.updateRole(
                tenant.id(),
                new TenantRoleUpdateRequest("MANAGER", BRANCH_1),
                owner
        );
        assertThat(promoted.role()).isEqualTo("MANAGER");
        assertThat(usersByEmail.get("duc@gmail.com").getRole()).isEqualTo(Role.MANAGER);

        // Manager 1 only sees TENANTs in Branch 1, so the promoted MANAGER is not visible to Manager 1
        var mgrView = tenantService.search(new TenantFilterRequest(null, null, null, null), PageRequest.of(0, 10), manager1);
        assertThat(mgrView.getContent()).isEmpty();

        // Owner sees the MANAGER when filtering by role = MANAGER
        var ownerMgrView = tenantService.search(new TenantFilterRequest(BRANCH_1, "MANAGER", null, "duc@gmail.com"), PageRequest.of(0, 10), owner);
        assertThat(ownerMgrView.getContent()).hasSize(1);
        assertThat(ownerMgrView.getContent().getFirst().role()).isEqualTo("MANAGER");

        // Owner demotes MANAGER -> TENANT
        TenantResponse demoted = tenantService.updateRole(
                promoted.id(),
                new TenantRoleUpdateRequest("TENANT", BRANCH_1),
                owner
        );
        assertThat(demoted.role()).isEqualTo("TENANT");
        assertThat(usersByEmail.get("duc@gmail.com").getRole()).isEqualTo(Role.TENANT);

        // Manager 1 can search by fullName ("Minh Đức") but searching by email ("duc@gmail.com") returns nothing for Manager
        var mgrByName = tenantService.search(new TenantFilterRequest(null, null, null, "Minh Đức"), PageRequest.of(0, 10), manager1);
        assertThat(mgrByName.getContent()).hasSize(1);

        var mgrByEmail = tenantService.search(new TenantFilterRequest(null, null, null, "duc@gmail.com"), PageRequest.of(0, 10), manager1);
        assertThat(mgrByEmail.getContent()).isEmpty();
    }
}
