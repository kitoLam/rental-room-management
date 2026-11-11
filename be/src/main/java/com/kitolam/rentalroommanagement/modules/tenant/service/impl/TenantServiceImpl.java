package com.kitolam.rentalroommanagement.modules.tenant.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.MessageResponse;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantBranchStatusRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantBranchStatsResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import com.kitolam.rentalroommanagement.modules.tenant.mapper.TenantMapper;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;
    private final ManagerRepository managerRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final BranchService branchService;
    private final RoomRepository roomRepository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantMapper tenantMapper;

    @Override
    public Optional<String> profileIdByEmail(String email) {
        return tenantRepository.findByEmailAndIsDeletedFalse(email).map(Tenant::getId);
    }

    @Override
    @Transactional
    public TenantResponse create(TenantCreateRequest request, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Map<String, String> managedBranchNames = managedBranchMap(principal);
        String targetBranchId = resolveTargetBranchForWrite(request.branchId(), managedBranchNames, principal, null);
        String branchName = managedBranchNames.get(targetBranchId);

        if (tenantRepository.findByEmailAndIsDeletedFalse(request.email()).isPresent()
                || userRepository.findByEmailAndIsDeletedFalse(request.email()).isPresent()
                || userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email này đã tồn tại tài khoản trong hệ thống");
        }
        if (tenantRepository.findByPhoneAndIsDeletedFalse(request.phone()).isPresent()
                || userRepository.findByPhoneAndIsDeletedFalse(request.phone()).isPresent()
                || userRepository.existsByPhone(request.phone())) {
            throw new ConflictException("Số điện thoại này đã tồn tại tài khoản trong hệ thống");
        }

        authService.createManagedTenantAccount(request.fullName(), request.email(), request.phone(), branchName);
        User createdUser = userRepository.findByEmailAndIsDeletedFalse(request.email()).orElse(null);

        Tenant tenant = new Tenant();
        tenant.setFullName(request.fullName());
        tenant.setEmail(request.email());
        tenant.setPhone(request.phone());
        tenant.setDateOfBirth(request.dateOfBirth());
        tenant.setGender(request.gender());
        tenant.setAvatarUrl(request.avatarUrl());
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.addBranch(targetBranchId);
        Tenant saved = tenantRepository.save(tenant);

        return tenantMapper.toBasicResponse(
                saved,
                createdUser,
                "TENANT",
                TenantStatus.ACTIVE,
                List.of(targetBranchId),
                branchName != null ? List.of(branchName) : List.of(),
                List.of(),
                null
        );
    }

    @Override
    public TenantResponse getById(String id, String branchId, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        Map<String, String> managedBranches = resolveScopedBranchMap(branchId, principal);
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());
        Set<String> tenantBranchesInScope = effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot);
        if (tenantBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Người thuê này không thuộc phạm vi cơ sở bạn quản lý");
        }
        User user = tenant.getEmail() != null
                ? userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null)
                : null;
        String effectiveRole = (user != null && user.getRole() == Role.MANAGER) ? "MANAGER" : "TENANT";
        return buildResponse(tenant, user, effectiveRole, tenantBranchesInScope, managedBranches, snapshot);
    }

    @Override
    public PagedResponse<TenantResponse> search(TenantFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        boolean isManagerCaller = "MANAGER".equals(principal.role());
        String requestedBranchId = (!isManagerCaller && filter != null) ? filter.branchId() : null;
        Map<String, String> scopedBranches = resolveScopedBranchMap(requestedBranchId, principal);
        if (scopedBranches.isEmpty()) {
            return PagedResponse.from(new PageImpl<>(List.of(), pageable, 0));
        }

        boolean includeManagers = !isManagerCaller;
        List<TenantResponse> allInScope = loadScopedAccountResponses(scopedBranches, includeManagers);

        String roleFilter = (!isManagerCaller && filter != null && filter.role() != null && !filter.role().isBlank())
                ? filter.role().strip().toUpperCase(Locale.ROOT)
                : null;
        TenantStatus statusFilter = (!isManagerCaller && filter != null) ? filter.status() : null;
        String keyword = (filter != null && filter.keyword() != null)
                ? filter.keyword().strip().toLowerCase(Locale.ROOT)
                : "";

        List<TenantResponse> filtered = allInScope.stream()
                .filter(item -> roleFilter == null || roleFilter.equalsIgnoreCase(item.role()))
                .filter(item -> statusFilter == null || item.status() == statusFilter)
                .filter(item -> {
                    if (keyword.isEmpty()) return true;
                    String fullName = item.fullName() != null ? item.fullName().toLowerCase(Locale.ROOT) : "";
                    if (isManagerCaller) {
                        // Manager chỉ tìm kiếm theo tên
                        return fullName.contains(keyword);
                    }
                    String email = item.email() != null ? item.email().toLowerCase(Locale.ROOT) : "";
                    String phone = item.phone() != null ? item.phone().toLowerCase(Locale.ROOT) : "";
                    String room = item.currentRoomNumber() != null ? item.currentRoomNumber().toLowerCase(Locale.ROOT) : "";
                    return fullName.contains(keyword) || email.contains(keyword) || phone.contains(keyword) || room.contains(keyword);
                })
                .toList();

        int start = (int) Math.min(pageable.getOffset(), filtered.size());
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<TenantResponse> pageContent = filtered.subList(start, end);
        return PagedResponse.from(new PageImpl<>(pageContent, pageable, filtered.size()));
    }

    @Override
    public TenantBranchStatsResponse stats(String branchId, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        boolean isManagerCaller = "MANAGER".equals(principal.role());
        Map<String, String> scopedBranches = resolveScopedBranchMap(isManagerCaller ? null : branchId, principal);
        String effectiveBranchId = scopedBranches.size() == 1 ? scopedBranches.keySet().iterator().next() : branchId;
        if (scopedBranches.isEmpty()) {
            return new TenantBranchStatsResponse(effectiveBranchId, 0, 0, 0, 0, 0);
        }
        List<TenantResponse> allInScope = loadScopedAccountResponses(scopedBranches, !isManagerCaller);
        long totalTenants = allInScope.stream().filter(t -> "TENANT".equals(t.role())).count();
        long totalManagers = allInScope.stream().filter(t -> "MANAGER".equals(t.role())).count();
        long active = allInScope.stream().filter(t -> t.status() == TenantStatus.ACTIVE).count();
        long inactive = allInScope.stream().filter(t -> t.status() == TenantStatus.INACTIVE).count();
        long pending = allInScope.stream().filter(t -> !t.emailVerified() || !t.passwordSet()).count();
        return new TenantBranchStatsResponse(effectiveBranchId, totalTenants, totalManagers, active, inactive, pending);
    }

    @Override
    @Transactional
    public TenantResponse update(String id, TenantUpdateRequest request, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        Map<String, String> managedBranches = managedBranchMap(principal);
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());
        Set<String> tenantBranchesInScope = effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot);
        if (tenantBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Người thuê này không thuộc phạm vi cơ sở bạn quản lý");
        }

        User user = tenant.getEmail() != null
                ? userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null)
                : null;

        if (request.phone() != null && !request.phone().equals(tenant.getPhone())) {
            var existingTenantPhone = tenantRepository.findByPhoneAndIsDeletedFalse(request.phone());
            if (existingTenantPhone.isPresent() && !existingTenantPhone.get().getId().equals(tenant.getId())) {
                throw new ConflictException("Số điện thoại này đã được sử dụng bởi người thuê khác");
            }
            var existingUserPhone = userRepository.findByPhoneAndIsDeletedFalse(request.phone());
            if (existingUserPhone.isPresent() && (user == null || !existingUserPhone.get().getId().equals(user.getId()))) {
                throw new ConflictException("Số điện thoại này đã tồn tại tài khoản trong hệ thống");
            }
            tenant.setPhone(request.phone());
            if (user != null) {
                user.setPhone(request.phone());
            }
        }
        if (request.fullName() != null) {
            tenant.setFullName(request.fullName().strip());
            if (user != null) {
                user.setFullName(request.fullName().strip());
            }
        }
        if (request.dateOfBirth() != null) {
            tenant.setDateOfBirth(request.dateOfBirth());
        }
        if (request.gender() != null) {
            tenant.setGender(request.gender());
        }
        if (request.avatarUrl() != null) {
            tenant.setAvatarUrl(request.avatarUrl());
        }
        if (request.status() != null) {
            String targetBranchId = resolveTargetBranchForWrite(request.branchId(), managedBranches, principal, tenantBranchesInScope);
            applyBranchStatus(tenant, targetBranchId, request.status());
        }
        if (user != null) {
            userRepository.save(user);
        }
        Tenant saved = tenantRepository.save(tenant);
        String effectiveRole = (user != null && user.getRole() == Role.MANAGER) ? "MANAGER" : "TENANT";
        return buildResponse(saved, user, effectiveRole, tenantBranchesInScope, managedBranches, snapshot);
    }

    @Override
    @Transactional
    public TenantResponse updateBranchStatus(String id, TenantBranchStatusRequest request, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Map<String, String> managedBranches = managedBranchMap(principal);
        Optional<Tenant> tenantOpt = tenantRepository.findByIdAndIsDeletedFalse(id);
        if (tenantOpt.isEmpty() && !"MANAGER".equals(principal.role())) {
            Manager manager = managerRepository.findByIdAndIsDeletedFalse(id)
                    .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người dùng"));
            if (manager.getBranchId() == null || !managedBranches.containsKey(manager.getBranchId())) {
                throw new ForbiddenException("Quản lý này không thuộc phạm vi cơ sở bạn sở hữu");
            }
            manager.setStatus(request.status() == TenantStatus.ACTIVE ? ManagerStatus.ACTIVE : ManagerStatus.INACTIVE);
            Manager savedMgr = managerRepository.save(manager);
            User mgrUser = savedMgr.getEmail() != null
                    ? userRepository.findByEmailAndIsDeletedFalse(savedMgr.getEmail()).orElse(null)
                    : null;
            return tenantMapper.fromManager(savedMgr, mgrUser, managedBranches.get(savedMgr.getBranchId()));
        }

        Tenant tenant = tenantOpt.orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());
        Set<String> tenantBranchesInScope = effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot);
        if (tenantBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Người thuê này không thuộc phạm vi cơ sở bạn quản lý");
        }

        String targetBranchId = resolveTargetBranchForWrite(request.branchId(), managedBranches, principal, tenantBranchesInScope);
        if (!tenantBranchesInScope.contains(targetBranchId)) {
            throw new ForbiddenException("Người thuê không thuộc cơ sở này");
        }
        applyBranchStatus(tenant, targetBranchId, request.status());
        Tenant saved = tenantRepository.save(tenant);
        User user = saved.getEmail() != null
                ? userRepository.findByEmailAndIsDeletedFalse(saved.getEmail()).orElse(null)
                : null;
        if (!"MANAGER".equals(principal.role()) && saved.getEmail() != null) {
            managerRepository.findByEmailAndIsDeletedFalse(saved.getEmail())
                    .filter(m -> targetBranchId.equals(m.getBranchId()))
                    .ifPresent(m -> {
                        m.setStatus(request.status() == TenantStatus.ACTIVE ? ManagerStatus.ACTIVE : ManagerStatus.INACTIVE);
                        managerRepository.save(m);
                    });
        }
        String effectiveRole = (user != null && user.getRole() == Role.MANAGER) ? "MANAGER" : "TENANT";
        Map<String, String> targetBranchMap = Map.of(targetBranchId, managedBranches.getOrDefault(targetBranchId, ""));
        return buildResponse(saved, user, effectiveRole, Set.of(targetBranchId), targetBranchMap, snapshot);
    }

    @Override
    @Transactional
    public TenantResponse updateRole(String id, TenantRoleUpdateRequest request, AuthPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        if (!List.of("OWNER", "ADMIN").contains(principal.role())) {
            throw new ForbiddenException("Chỉ Chủ cơ sở (Owner) mới được nâng hoặc hạ vai trò của người thuê và quản lý");
        }

        Map<String, String> managedBranches = managedBranchMap(principal);
        if (managedBranches.isEmpty()) {
            throw new ForbiddenException("Bạn chưa sở hữu cơ sở nào");
        }
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());

        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(id).orElse(null);
        Manager manager = (tenant == null)
                ? managerRepository.findByIdAndIsDeletedFalse(id).orElse(null)
                : (tenant.getEmail() != null ? managerRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null) : null);

        if (tenant == null && manager == null) {
            throw new NotFoundException("Không tìm thấy tài khoản trong phạm vi cơ sở");
        }
        if (tenant == null && manager.getEmail() != null) {
            tenant = tenantRepository.findByEmailAndIsDeletedFalse(manager.getEmail()).orElse(null);
        }

        Set<String> accountBranchesInScope = new HashSet<>();
        if (tenant != null) {
            accountBranchesInScope.addAll(effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot));
        }
        if (manager != null && manager.getBranchId() != null && managedBranches.containsKey(manager.getBranchId())) {
            accountBranchesInScope.add(manager.getBranchId());
        }
        if (accountBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Tài khoản này không thuộc phạm vi cơ sở bạn sở hữu");
        }

        String targetBranchId = resolveTargetBranchForWrite(request.branchId(), managedBranches, principal, accountBranchesInScope);
        String email = tenant != null ? tenant.getEmail() : manager.getEmail();
        String fullName = tenant != null ? tenant.getFullName() : manager.getFullName();
        String phone = tenant != null ? tenant.getPhone() : manager.getPhone();

        User user = (email != null)
                ? userRepository.findByEmailAndIsDeletedFalse(email).orElse(null)
                : null;
        if (user != null && (user.getRole() == Role.OWNER || user.getRole() == Role.ADMIN)) {
            throw new ForbiddenException("Không thể thay đổi vai trò của Chủ cơ sở hoặc Quản trị viên");
        }

        if ("MANAGER".equals(request.role())) {
            if (user != null) {
                user.setRole(Role.MANAGER);
                userRepository.save(user);
            }
            Manager mgrRecord = manager != null ? manager : new Manager();
            mgrRecord.setBranchId(targetBranchId);
            mgrRecord.setFullName(fullName);
            mgrRecord.setEmail(email);
            mgrRecord.setPhone(phone);
            mgrRecord.setStatus(ManagerStatus.ACTIVE);
            if (mgrRecord.getPermissions() == null) {
                mgrRecord.setPermissions(new ArrayList<>());
            }
            if (!mgrRecord.getPermissions().contains(ManagerService.VIEWING_PERMISSION)) {
                mgrRecord.getPermissions().add(ManagerService.VIEWING_PERMISSION);
            }
            Manager savedMgr = managerRepository.save(mgrRecord);

            if (tenant != null) {
                tenant.setBranchActiveStatus(targetBranchId, true);
                Tenant savedTenant = tenantRepository.save(tenant);
                accountBranchesInScope.add(targetBranchId);
                return buildResponse(savedTenant, user, "MANAGER", accountBranchesInScope, managedBranches, snapshot);
            }
            return tenantMapper.fromManager(savedMgr, user, managedBranches.get(targetBranchId));
        } else {
            // Hạ role từ MANAGER xuống TENANT
            if (user != null) {
                user.setRole(Role.TENANT);
                userRepository.save(user);
            }
            if (manager != null) {
                manager.setStatus(ManagerStatus.INACTIVE);
                managerRepository.save(manager);
            }
            Tenant tenantRecord = tenant != null ? tenant : new Tenant();
            tenantRecord.setFullName(fullName);
            tenantRecord.setEmail(email);
            tenantRecord.setPhone(phone);
            tenantRecord.setStatus(TenantStatus.ACTIVE);
            tenantRecord.setBranchActiveStatus(targetBranchId, true);
            Tenant savedTenant = tenantRepository.save(tenantRecord);
            accountBranchesInScope.add(targetBranchId);
            return buildResponse(savedTenant, user, "TENANT", accountBranchesInScope, managedBranches, snapshot);
        }
    }

    @Override
    @Transactional
    public MessageResponse resendVerification(String id, String branchId, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        Map<String, String> managedBranches = managedBranchMap(principal);
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());
        Set<String> tenantBranchesInScope = effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot);
        if (tenantBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Người thuê này không thuộc phạm vi cơ sở bạn quản lý");
        }
        String targetBranchId = resolveTargetBranchForWrite(branchId, managedBranches, principal, tenantBranchesInScope);
        String branchName = managedBranches.get(targetBranchId);
        return authService.resendManagedTenantVerification(tenant.getEmail(), branchName);
    }

    @Override
    @Transactional
    public void delete(String id, AuthPrincipal principal) {
        requireManagementPrincipal(principal);
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        Map<String, String> managedBranches = managedBranchMap(principal);
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(managedBranches.keySet());
        Set<String> tenantBranchesInScope = effectiveBranchesInScope(tenant, managedBranches.keySet(), snapshot);
        if (tenantBranchesInScope.isEmpty()) {
            throw new ForbiddenException("Người thuê này không thuộc phạm vi cơ sở bạn quản lý");
        }
        for (String bId : tenantBranchesInScope) {
            tenant.setBranchActiveStatus(bId, false);
        }
        tenantRepository.save(tenant);
    }

    private void applyBranchStatus(Tenant tenant, String branchId, TenantStatus requestedStatus) {
        if (requestedStatus != TenantStatus.ACTIVE && requestedStatus != TenantStatus.INACTIVE) {
            throw new BadRequestException("Trạng thái tại cơ sở chỉ nhận ACTIVE hoặc INACTIVE");
        }
        tenant.setBranchActiveStatus(branchId, requestedStatus == TenantStatus.ACTIVE);
    }

    private void requireManagementPrincipal(AuthPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        if (!List.of("MANAGER", "OWNER", "ADMIN").contains(principal.role())) {
            throw new ForbiddenException("Chỉ Quản lý hoặc Chủ cơ sở mới được thực hiện thao tác này");
        }
    }

    private Map<String, String> managedBranchMap(AuthPrincipal principal) {
        List<BranchResponse> branches = branchService.managedBranches(principal);
        Map<String, String> map = new LinkedHashMap<>();
        for (BranchResponse b : branches) {
            map.put(b.id(), b.name());
        }
        return map;
    }

    private Map<String, String> resolveScopedBranchMap(String requestedBranchId, AuthPrincipal principal) {
        Map<String, String> managed = managedBranchMap(principal);
        String trimmed = requestedBranchId == null ? null : requestedBranchId.strip();
        if (trimmed != null && !trimmed.isEmpty()) {
            if (!managed.containsKey(trimmed)) {
                branchService.requireManagementAccess(trimmed, principal);
            }
            return Map.of(trimmed, managed.getOrDefault(trimmed, ""));
        }
        if ("MANAGER".equals(principal.role()) && managed.isEmpty()) {
            throw new ForbiddenException("Tài khoản Quản lý chưa được phân công cơ sở đang hoạt động");
        }
        return managed;
    }

    private String resolveTargetBranchForWrite(
            String requestedBranchId,
            Map<String, String> managedBranches,
            AuthPrincipal principal,
            Set<String> tenantBranchesInScope
    ) {
        String trimmed = requestedBranchId == null ? null : requestedBranchId.strip();
        if ("MANAGER".equals(principal.role())) {
            if (managedBranches.isEmpty()) {
                throw new ForbiddenException("Tài khoản Quản lý chưa được phân công cơ sở đang hoạt động");
            }
            String assignedBranchId = managedBranches.keySet().iterator().next();
            if (trimmed != null && !trimmed.isEmpty() && !assignedBranchId.equals(trimmed)) {
                throw new ForbiddenException("Quản lý chỉ được thao tác trên cơ sở được chỉ định");
            }
            return assignedBranchId;
        }
        if (trimmed != null && !trimmed.isEmpty()) {
            if (!managedBranches.containsKey(trimmed)) {
                branchService.requireManagementAccess(trimmed, principal);
            }
            return trimmed;
        }
        if (tenantBranchesInScope != null && tenantBranchesInScope.size() == 1) {
            return tenantBranchesInScope.iterator().next();
        }
        if (managedBranches.size() == 1) {
            return managedBranches.keySet().iterator().next();
        }
        throw new BadRequestException("Vui lòng chọn cơ sở để thực hiện thao tác");
    }

    private List<TenantResponse> loadScopedAccountResponses(
            Map<String, String> scopedBranches,
            boolean includeManagers
    ) {
        Set<String> branchIds = scopedBranches.keySet();
        BranchTenancySnapshot snapshot = loadBranchTenancySnapshot(branchIds);
        List<Tenant> allTenants = tenantRepository.findByIsDeletedFalse();
        List<Manager> branchManagers = includeManagers
                ? managerRepository.findByBranchIdInAndIsDeletedFalse(branchIds)
                : List.of();

        Map<String, Manager> activeManagerByEmail = new HashMap<>();
        if (branchManagers != null) {
            for (Manager m : branchManagers) {
                if (m.getEmail() != null && !m.getEmail().isBlank()) {
                    activeManagerByEmail.put(m.getEmail().toLowerCase(Locale.ROOT), m);
                }
            }
        }

        List<Tenant> matchedTenants = new ArrayList<>();
        Map<String, Set<String>> branchesByTenantId = new HashMap<>();
        Set<String> handledEmails = new HashSet<>();

        for (Tenant tenant : allTenants) {
            Set<String> inScope = effectiveBranchesInScope(tenant, branchIds, snapshot);
            String emailKey = tenant.getEmail() != null ? tenant.getEmail().toLowerCase(Locale.ROOT) : "";
            Manager mgr = !emailKey.isEmpty() ? activeManagerByEmail.get(emailKey) : null;
            if (mgr != null && mgr.getBranchId() != null && branchIds.contains(mgr.getBranchId())) {
                inScope.add(mgr.getBranchId());
            }
            if (!inScope.isEmpty()) {
                matchedTenants.add(tenant);
                branchesByTenantId.put(tenant.getId(), inScope);
                if (!emailKey.isEmpty()) {
                    handledEmails.add(emailKey);
                }
            }
        }

        Set<String> allEmails = new HashSet<>();
        matchedTenants.stream()
                .map(Tenant::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .forEach(allEmails::add);
        if (branchManagers != null) {
            branchManagers.stream()
                    .map(Manager::getEmail)
                    .filter(e -> e != null && !e.isBlank())
                    .forEach(allEmails::add);
        }

        Map<String, User> userByEmail = new HashMap<>();
        for (String email : allEmails) {
            userRepository.findByEmailAndIsDeletedFalse(email).ifPresent(u -> userByEmail.put(email, u));
        }

        List<TenantResponse> results = new ArrayList<>();

        for (Tenant tenant : matchedTenants) {
            User user = userByEmail.get(tenant.getEmail());
            String emailKey = tenant.getEmail() != null ? tenant.getEmail().toLowerCase(Locale.ROOT) : "";
            Manager mgr = !emailKey.isEmpty() ? activeManagerByEmail.get(emailKey) : null;
            boolean isManagerAccount = (user != null && user.getRole() == Role.MANAGER)
                    || (mgr != null && mgr.getStatus() == ManagerStatus.ACTIVE);
            if (!includeManagers && isManagerAccount) {
                // Manager caller only sees TENANT accounts
                continue;
            }
            String effectiveRole = isManagerAccount ? "MANAGER" : "TENANT";
            results.add(buildResponse(
                    tenant,
                    user,
                    effectiveRole,
                    branchesByTenantId.get(tenant.getId()),
                    scopedBranches,
                    snapshot
            ));
        }

        if (includeManagers && branchManagers != null) {
            for (Manager m : branchManagers) {
                String emailKey = m.getEmail() != null ? m.getEmail().toLowerCase(Locale.ROOT) : "";
                if (!emailKey.isEmpty() && handledEmails.contains(emailKey)) {
                    continue;
                }
                User user = userByEmail.get(m.getEmail());
                if (user != null && user.getRole() == Role.TENANT && m.getStatus() != ManagerStatus.ACTIVE) {
                    continue;
                }
                results.add(tenantMapper.fromManager(
                        m,
                        user,
                        scopedBranches.get(m.getBranchId())
                ));
            }
        }

        results.sort(this::compareByRoomThenName);
        return results;
    }

    private int compareByRoomThenName(TenantResponse a, TenantResponse b) {
        String roomA = a.currentRoomNumber();
        String roomB = b.currentRoomNumber();
        boolean hasA = roomA != null && !roomA.isBlank();
        boolean hasB = roomB != null && !roomB.isBlank();
        if (hasA && hasB) {
            int cmp = compareRoomCode(roomA.trim(), roomB.trim());
            if (cmp != 0) return cmp;
        } else if (hasA != hasB) {
            return hasA ? -1 : 1;
        }
        String nameA = a.fullName() != null ? a.fullName() : "";
        String nameB = b.fullName() != null ? b.fullName() : "";
        return nameA.compareToIgnoreCase(nameB);
    }

    private int compareRoomCode(String a, String b) {
        int i = 0, j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int startI = i;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                int startJ = j;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                long numA = Long.parseLong(a.substring(startI, i));
                long numB = Long.parseLong(b.substring(startJ, j));
                if (numA != numB) return Long.compare(numA, numB);
            } else {
                int cmp = Character.compare(Character.toLowerCase(ca), Character.toLowerCase(cb));
                if (cmp != 0) return cmp;
                i++;
                j++;
            }
        }
        return Integer.compare(a.length(), b.length());
    }

    private Set<String> effectiveBranchesInScope(
            Tenant tenant,
            Set<String> scopedBranchIds,
            BranchTenancySnapshot snapshot
    ) {
        Set<String> result = new HashSet<>();
        Set<String> fromActiveContracts = snapshot.branchesByTenantId().get(tenant.getId());
        if (fromActiveContracts != null) {
            for (String bId : fromActiveContracts) {
                if (scopedBranchIds.contains(bId)) {
                    result.add(bId);
                }
            }
        }
        if (!snapshot.hasRooms() && tenant.getBranchIds() != null) {
            for (String bId : tenant.getBranchIds()) {
                if (scopedBranchIds.contains(bId)) {
                    result.add(bId);
                }
            }
        }
        return result;
    }

    private TenantResponse buildResponse(
            Tenant tenant,
            User user,
            String effectiveRole,
            Set<String> tenantBranchesInScope,
            Map<String, String> scopedBranches,
            BranchTenancySnapshot snapshot
    ) {
        List<String> orderedBranchIds = scopedBranches.keySet().stream()
                .filter(tenantBranchesInScope::contains)
                .toList();
        List<String> branchNames = orderedBranchIds.stream()
                .map(scopedBranches::get)
                .filter(name -> name != null && !name.isBlank())
                .toList();
        List<String> scopedInactive = orderedBranchIds.stream()
                .filter(tenant::isInactiveInBranch)
                .toList();

        TenantStatus branchStatus = (!orderedBranchIds.isEmpty() && scopedInactive.size() == orderedBranchIds.size())
                ? TenantStatus.INACTIVE
                : TenantStatus.ACTIVE;

        String currentRoom = snapshot.activeRoomNumberByTenantId().get(tenant.getId());
        return tenantMapper.toBasicResponse(
                tenant,
                user,
                effectiveRole,
                branchStatus,
                orderedBranchIds,
                branchNames,
                scopedInactive,
                currentRoom
        );
    }

    private BranchTenancySnapshot loadBranchTenancySnapshot(Set<String> branchIds) {
        if (branchIds == null || branchIds.isEmpty()) {
            return new BranchTenancySnapshot(false, Map.of(), Map.of());
        }
        List<Room> rooms = roomRepository.findByBranchIdInAndIsDeletedFalse(branchIds);
        if (rooms.isEmpty()) {
            return new BranchTenancySnapshot(false, Map.of(), Map.of());
        }
        Map<String, Room> roomById = rooms.stream().collect(Collectors.toMap(Room::getId, r -> r));
        List<Contract> contracts = contractRepository.findByRoomIdInAndIsDeletedFalse(roomById.keySet());
        if (contracts.isEmpty()) {
            return new BranchTenancySnapshot(true, Map.of(), Map.of());
        }
        Map<String, Contract> contractById = contracts.stream().collect(Collectors.toMap(Contract::getId, c -> c));
        List<ContractTenant> contractTenants = contractTenantRepository.findByContractIdInAndIsDeletedFalse(contractById.keySet());

        Map<String, Set<String>> branchesByTenantId = new HashMap<>();
        Map<String, String> activeRoomNumberByTenantId = new HashMap<>();

        for (Contract c : contracts) {
            if (c.getStatus() != ContractStatus.ACTIVE) continue;
            Room room = roomById.get(c.getRoomId());
            if (room == null || c.getTenantId() == null) continue;
            branchesByTenantId.computeIfAbsent(c.getTenantId(), k -> new HashSet<>()).add(room.getBranchId());
            if (room.getRoomNumber() != null) {
                activeRoomNumberByTenantId.putIfAbsent(c.getTenantId(), room.getRoomNumber());
            }
        }

        for (ContractTenant ct : contractTenants) {
            if (ct.getStatus() != ContractTenantStatus.ACTIVE) continue;
            Contract c = contractById.get(ct.getContractId());
            if (c == null || c.getStatus() != ContractStatus.ACTIVE || ct.getTenantId() == null) continue;
            Room room = roomById.get(c.getRoomId());
            if (room == null) continue;
            branchesByTenantId.computeIfAbsent(ct.getTenantId(), k -> new HashSet<>()).add(room.getBranchId());
            if (room.getRoomNumber() != null) {
                activeRoomNumberByTenantId.put(ct.getTenantId(), room.getRoomNumber());
            }
        }

        return new BranchTenancySnapshot(true, branchesByTenantId, activeRoomNumberByTenantId);
    }

    private record BranchTenancySnapshot(
            boolean hasRooms,
            Map<String, Set<String>> branchesByTenantId,
            Map<String, String> activeRoomNumberByTenantId
    ) {}
}
