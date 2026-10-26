package com.kitolam.rentalroommanagement.modules.serviceitem.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.repository.ServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ServiceItemServiceImpl implements ServiceItemService {

    private final ServiceItemRepository serviceItemRepository;

    @Override
    public ServiceItemResponse create(ServiceItemCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ServiceItemResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ServiceItemResponse> search(ServiceItemFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ServiceItemResponse update(String id, ServiceItemUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
