package com.kitolam.rentalroommanagement.modules.contracttenant.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.ContractTenantResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.EligibleContractTenantResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ContractTenantServiceImpl implements ContractTenantService {

    private final ContractTenantRepository contractTenantRepository;
    private final ContractRepository contractRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final BranchService branchAccess;

    @Override
    @Transactional
    public ContractTenantResponse create(ContractTenantCreateRequest request, AuthPrincipal principal) {
        Contract contract = authorizedContract(request.contractId(), principal);
        if (contract.getStatus() != ContractStatus.DRAFT && contract.getStatus() != ContractStatus.ACTIVE)
            throw new ConflictException("Chỉ hợp đồng nháp hoặc đang hiệu lực mới thêm được người thuê");
        Tenant tenant = tenantRepository.findByIdAndIsDeletedFalse(request.tenantId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ Tenant"));
        if (tenant.getStatus() != TenantStatus.ACTIVE)
            throw new ConflictException("Tài khoản Tenant hiện không hoạt động");
        if (contractTenantRepository.existsByContractIdAndTenantIdAndIsDeletedFalse(contract.getId(), tenant.getId()))
            throw new ConflictException("Tenant đã thuộc hợp đồng này");
        validateDates(request.joinedAt(), request.leftAt());

        ContractTenant item = new ContractTenant();
        item.setContractId(contract.getId());
        item.setTenantId(tenant.getId());
        item.setBookingId(request.bookingId());
        item.setIsRepresentative(Boolean.TRUE.equals(request.isRepresentative()));
        item.setRentAmount(request.rentAmount());
        item.setJoinedAt(request.joinedAt());
        item.setLeftAt(request.leftAt());
        item.setStatus(ContractTenantStatus.ACTIVE);
        if (Boolean.TRUE.equals(item.getIsRepresentative())) clearRepresentative(contract.getId(), null);
        return response(contractTenantRepository.save(item), tenant);
    }

    @Override
    public ContractTenantResponse getById(String id, AuthPrincipal principal) {
        ContractTenant item = find(id);
        authorizedContract(item.getContractId(), principal);
        return response(item, tenant(item.getTenantId()));
    }

    @Override
    public PagedResponse<ContractTenantResponse> search(ContractTenantFilterRequest filter, Pageable pageable,
            AuthPrincipal principal) {
        if (filter.contractId() == null && (principal == null || !"ADMIN".equals(principal.role())))
            throw new BadRequestException("Cần chỉ định contractId để xem thành viên hợp đồng");
        if (filter.contractId() != null) authorizedContract(filter.contractId(), principal);

        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (filter.contractId() != null)
            criteria.add(Criteria.where("contractId").is(MongoQueryHelper.toObjectId(filter.contractId())));
        if (filter.tenantId() != null)
            criteria.add(Criteria.where("tenantId").is(MongoQueryHelper.toObjectId(filter.tenantId())));
        if (filter.bookingId() != null)
            criteria.add(Criteria.where("bookingId").is(MongoQueryHelper.toObjectId(filter.bookingId())));
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        var page = contractTenantRepository.findWithPagination(new Criteria().andOperator(criteria), pageable);
        return PagedResponse.from(page, item -> response(item, tenant(item.getTenantId())));
    }

    @Override
    @Transactional
    public ContractTenantResponse update(String id, ContractTenantUpdateRequest request, AuthPrincipal principal) {
        ContractTenant item = find(id);
        authorizedContract(item.getContractId(), principal);
        LocalDate joinedAt = request.joinedAt() == null ? item.getJoinedAt() : request.joinedAt();
        LocalDate leftAt = request.leftAt() == null ? item.getLeftAt() : request.leftAt();
        validateDates(joinedAt, leftAt);
        if (request.bookingId() != null) item.setBookingId(request.bookingId());
        if (request.isRepresentative() != null) item.setIsRepresentative(request.isRepresentative());
        if (request.rentAmount() != null) item.setRentAmount(request.rentAmount());
        if (request.joinedAt() != null) item.setJoinedAt(request.joinedAt());
        if (request.leftAt() != null) item.setLeftAt(request.leftAt());
        if (request.status() != null) item.setStatus(request.status());
        if (Boolean.TRUE.equals(item.getIsRepresentative())) clearRepresentative(item.getContractId(), item.getId());
        return response(contractTenantRepository.save(item), tenant(item.getTenantId()));
    }

    @Override
    @Transactional
    public void delete(String id, AuthPrincipal principal) {
        ContractTenant item = find(id);
        authorizedContract(item.getContractId(), principal);
        item.markDeleted();
        contractTenantRepository.save(item);
    }

    @Override
    public List<EligibleContractTenantResponse> eligibleTenants(String contractId, AuthPrincipal principal) {
        authorizedContract(contractId, principal);
        List<User> users = userRepository.findByRoleInAndEnabledTrueAndEmailVerifiedTrueAndIsDeletedFalse(List.of(Role.TENANT));
        if (users.isEmpty()) return List.of();
        List<String> emails = users.stream().map(User::getEmail).filter(email -> email != null && !email.isBlank()).toList();
        if (emails.isEmpty()) return List.of();
        Map<String, Tenant> tenantsByEmail = tenantRepository.findByEmailInAndIsDeletedFalse(emails).stream()
                .collect(Collectors.toMap(Tenant::getEmail, tenant -> tenant));
        List<String> linkedTenantIds = contractTenantRepository.findByContractIdAndIsDeletedFalse(contractId).stream()
                .map(ContractTenant::getTenantId).toList();
        return users.stream()
                .filter(user -> tenantsByEmail.containsKey(user.getEmail()))
                .map(user -> Map.entry(user, tenantsByEmail.get(user.getEmail())))
                .filter(entry -> entry.getValue().getStatus() == TenantStatus.ACTIVE)
                .filter(entry -> !linkedTenantIds.contains(entry.getValue().getId()))
                .map(entry -> new EligibleContractTenantResponse(entry.getValue().getId(), entry.getKey().getFullName(),
                        entry.getKey().getEmail(), entry.getKey().getPhone()))
                .toList();
    }

    private void clearRepresentative(String contractId, String exceptId) {
        for (ContractTenant current : contractTenantRepository.findByContractIdAndIsDeletedFalse(contractId)) {
            if (!Boolean.TRUE.equals(current.getIsRepresentative()) || current.getId().equals(exceptId)) continue;
            current.setIsRepresentative(false);
            contractTenantRepository.save(current);
        }
    }

    private Contract authorizedContract(String contractId, AuthPrincipal principal) {
        Contract contract = contractRepository.findByIdAndIsDeletedFalse(contractId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
        if (principal == null) throw new ForbiddenException("Vui lòng đăng nhập");
        if ("ADMIN".equals(principal.role())) return contract;
        if (!List.of("OWNER", "MANAGER").contains(principal.role()))
            throw new ForbiddenException("Chỉ Owner/Manager mới được quản lý thành viên hợp đồng");
        Room room = roomRepository.findByIdAndIsDeletedFalse(contract.getRoomId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
        branchAccess.requireManagementAccess(room.getBranchId(), principal);
        return contract;
    }

    private ContractTenant find(String id) {
        return contractTenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thành viên hợp đồng"));
    }

    private Tenant tenant(String id) {
        return tenantRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ Tenant"));
    }

    private void validateDates(LocalDate joinedAt, LocalDate leftAt) {
        if (joinedAt == null || (leftAt != null && leftAt.isBefore(joinedAt)))
            throw new BadRequestException("Ngày rời đi phải bằng hoặc sau ngày bắt đầu cư trú");
    }

    private ContractTenantResponse response(ContractTenant item, Tenant tenant) {
        return new ContractTenantResponse(item.getId(), item.getContractId(), item.getTenantId(), item.getBookingId(),
                tenant.getFullName(), tenant.getEmail(), item.getIsRepresentative(), item.getRentAmount(), item.getJoinedAt(),
                item.getLeftAt(), item.getStatus(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
