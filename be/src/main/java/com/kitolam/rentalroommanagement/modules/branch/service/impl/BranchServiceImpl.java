package com.kitolam.rentalroommanagement.modules.branch.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchCreateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchFilterRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchUpdateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.mapper.BranchMapper;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import java.util.ArrayList;
import java.util.List;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import java.time.Clock;

@Service
@RequiredArgsConstructor
public class BranchServiceImpl implements BranchService {

    private final BranchRepository branchRepository;
    private final BranchMapper mapper;
    private final ManagerService managers;
    private final MongoTemplate mongo;
    private final Clock clock;

    @Override
    public void requireManagementAccess(String branchId, AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        var branch = getById(branchId);
        boolean owner = "OWNER".equals(principal.role()) && principal.userId().equals(branch.ownerAccountId());
        boolean manager = "MANAGER".equals(principal.role()) && managers.findAssignment(principal.email())
                .filter(m -> m.status() == ManagerStatus.ACTIVE && branchId.equals(m.branchId())).isPresent();
        if (!owner && !manager) throw new ForbiddenException("Bạn không có quyền quản lý chi nhánh này");
    }

    @Override
    public UtilityRatesResponse utilityRates(String branchId, AuthPrincipal principal) {
        requireManagementAccess(branchId, principal);
        return mapper.toUtilityRates(branchRepository.findByIdAndIsDeletedFalse(branchId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chi nhánh")));
    }

    @Override
    public UtilityRatesResponse updateUtilityRates(String branchId, UtilityRatesRequest request, AuthPrincipal principal) {
        requireManagementAccess(branchId, principal);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(MongoQueryHelper.toObjectId(branchId)).and("isDeleted").is(false)),
                new Update().set("electricityRate", request.electricityRate()).set("waterRate", request.waterRate())
                        .set("parkingRate", request.parkingRate()).set("updatedAt", clock.instant()), Branch.class);
        return utilityRates(branchId, principal);
    }

    @Override
    public List<BranchResponse> managedBranches(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        if (principal.role().equals("OWNER")) return branchRepository.findByOwnerAccountIdAndIsDeletedFalse(principal.userId()).stream().map(mapper::toResponse).toList();
        if (principal.role().equals("MANAGER")) return managers.findAssignment(principal.email())
                .filter(m -> m.status() == ManagerStatus.ACTIVE)
                .map(m -> List.of(getById(m.branchId()))).orElse(List.of());
        if (principal.role().equals("ADMIN")) return branchRepository.findWithPagination(PageRequest.of(0, 100)).stream().map(mapper::toResponse).toList();
        throw new ForbiddenException("Không có quyền quản lý chi nhánh");
    }

    @Override
    public Set<String> ownedBranchIds(String accountId) {
        return branchRepository.findByOwnerAccountIdAndIsDeletedFalse(accountId).stream()
                .map(b -> b.getId()).collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public BranchResponse create(BranchCreateRequest request) {
        Branch branch = new Branch();
        branch.setName(request.name().trim());
        branch.setAddress(request.address().trim());
        branch.setPhone(request.phone());
        branch.setEmail(request.email());
        branch.setDescription(request.description());
        branch.setStatus(BranchStatus.ACTIVE);
        branchRepository.insert(branch);
        return mapper.toResponse(branch);
    }

    @Override
    public BranchResponse getById(String id) {
        return mapper.toResponse(branchRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chi nhánh")));
    }

    @Override
    public PagedResponse<BranchResponse> search(BranchFilterRequest filter, Pageable pageable) {
        Criteria criteria = null;
        List<Criteria> list = new ArrayList<>();
        if (filter != null) {
            if (filter.status() != null) {
                list.add(Criteria.where("status").is(filter.status()));
            }
            if (filter.keyword() != null && !filter.keyword().isBlank()) {
                String kw = filter.keyword().trim();
                list.add(new Criteria().orOperator(
                        Criteria.where("name").regex(kw, "i"),
                        Criteria.where("address").regex(kw, "i"),
                        Criteria.where("phone").regex(kw, "i")
                ));
            }
        }
        if (!list.isEmpty()) {
            criteria = new Criteria().andOperator(list.toArray(new Criteria[0]));
        }
        var page = branchRepository.findWithPagination(criteria, pageable);
        return PagedResponse.from(page, mapper::toResponse);
    }

    @Override
    public BranchResponse update(String id, BranchUpdateRequest request) {
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chi nhánh"));
        if (request.name() != null && !request.name().isBlank()) branch.setName(request.name().trim());
        if (request.address() != null && !request.address().isBlank()) branch.setAddress(request.address().trim());
        if (request.phone() != null) branch.setPhone(request.phone());
        if (request.email() != null) branch.setEmail(request.email());
        if (request.description() != null) branch.setDescription(request.description());
        if (request.status() != null) branch.setStatus(request.status());
        branchRepository.save(branch);
        return mapper.toResponse(branch);
    }

    @Override
    public void delete(String id) {
        Branch branch = branchRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chi nhánh"));
        branch.markDeleted();
        branchRepository.save(branch);
    }
}
