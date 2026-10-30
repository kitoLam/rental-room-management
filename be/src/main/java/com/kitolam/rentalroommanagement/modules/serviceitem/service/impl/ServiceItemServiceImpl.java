package com.kitolam.rentalroommanagement.modules.serviceitem.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceService;
import com.kitolam.rentalroommanagement.modules.serviceitem.document.ServiceItem;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.mapper.ServiceItemMapper;
import com.kitolam.rentalroommanagement.modules.serviceitem.repository.ServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ServiceItemServiceImpl implements ServiceItemService {

    private final ServiceItemRepository serviceItemRepository;
    private final ServiceItemMapper mapper;
    private final MongoTemplate mongoTemplate;
    private final RoomServiceService roomServices;
    private final SlotServiceService slotServices;

    @Override
    public ServiceItemResponse create(ServiceItemCreateRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (MongoQueryHelper.existsOther(mongoTemplate, ServiceItem.class, null, Criteria.where("code").is(code))) {
            throw new ConflictException("Mã dịch vụ đã tồn tại");
        }
        ServiceItem serviceItem = mapper.toDocument(request);
        serviceItem.setCode(code);
        return mapper.toResponse(serviceItemRepository.save(serviceItem));
    }

    @Override
    public ServiceItemResponse getById(String id) {
        return mapper.toResponse(find(id));
    }

    @Override
    public PagedResponse<ServiceItemResponse> search(ServiceItemFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addEquals(criteria, "calculationType", filter.calculationType());
        MongoQueryHelper.addEquals(criteria, "scope", filter.scope());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "code", "name");
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, ServiceItem.class), mapper::toResponse);
    }

    @Override
    public ServiceItemResponse update(String id, ServiceItemUpdateRequest request) {
        ServiceItem serviceItem = find(id);
        boolean changesBilling = (request.scope() != null && request.scope() != serviceItem.getScope())
                || (request.calculationType() != null && request.calculationType() != serviceItem.getCalculationType());
        if (changesBilling && inUse(id)) {
            throw new ConflictException("Dịch vụ đang được sử dụng, không thể đổi phạm vi hoặc cách tính phí");
        }
        mapper.update(request, serviceItem);
        return mapper.toResponse(serviceItemRepository.save(serviceItem));
    }

    @Override
    public void delete(String id) {
        ServiceItem serviceItem = find(id);
        if (inUse(id)) {
            throw new ConflictException("Dịch vụ đang được sử dụng. Hãy chuyển sang INACTIVE để ngừng nhận đăng ký mới");
        }
        serviceItem.markDeleted();
        serviceItemRepository.save(serviceItem);
    }

    @Override
    public ServiceItemResponse requireActive(String id) {
        ServiceItem serviceItem = find(id);
        if (serviceItem.getStatus() != ServiceStatus.ACTIVE) {
            throw new BadRequestException("Dịch vụ đã ngừng cung cấp");
        }
        return mapper.toResponse(serviceItem);
    }

    @Override
    public List<ServiceItemResponse> listSubscribable(Set<ServiceScope> scopes) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("status").is(ServiceStatus.ACTIVE.name()));
        criteria.add(Criteria.where("scope").in(scopes.stream().map(Enum::name).toList()));
        criteria.add(Criteria.where("calculationType").ne(CalculationType.METERED.name()));
        Query query = new Query(new Criteria().andOperator(criteria)).with(Sort.by("name"));
        return mongoTemplate.find(query, ServiceItem.class).stream().map(mapper::toResponse).toList();
    }

    private ServiceItem find(String id) {
        return serviceItemRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ"));
    }

    private boolean inUse(String serviceId) {
        return roomServices.countActiveByService(serviceId) + slotServices.countActiveByService(serviceId) > 0;
    }
}
