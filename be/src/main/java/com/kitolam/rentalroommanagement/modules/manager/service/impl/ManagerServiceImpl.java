package com.kitolam.rentalroommanagement.modules.manager.service.impl;

import org.springframework.data.mongodb.core.MongoTemplate;

import com.kitolam.rentalroommanagement.modules.manager.document.Manager;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerCreateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerFilterRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerUpdateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import com.kitolam.rentalroommanagement.modules.manager.mapper.ManagerMapper;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ManagerServiceImpl implements ManagerService {

    private final MongoTemplate overviewMongo;

    private final ManagerRepository managerRepository;
    private final ManagerMapper mapper;

    @Override
    public Optional<ManagerResponse> findAssignment(String email) {
        return managerRepository.findByEmailAndIsDeletedFalse(email).map(mapper::toResponse);
    }

    @Override
    public void deactivateByEmail(String email) {
        if (email == null) return;
        var query = org.springframework.data.mongodb.core.query.Query.query(MongoQueryHelper.notDeleted()
                .and("email").is(email));
        overviewMongo.update(Manager.class).matching(query)
                .apply(new org.springframework.data.mongodb.core.query.Update().set("status", "INACTIVE"))
                .all();
    }

    @Override
    public ManagerResponse create(ManagerCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ManagerResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ManagerResponse> search(ManagerFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ManagerResponse update(String id, ManagerUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
    @Override
    public List<OverviewManager> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("branchId", ids);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").is("ACTIVE"));
        query.fields().include("branchId", "fullName");
        return overviewMongo.find(query, Manager.class).stream()
                .map(item -> new OverviewManager(item.getBranchId(), item.getFullName())).toList();
    }
}
