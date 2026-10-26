package com.kitolam.rentalroommanagement.modules.serviceitem.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import org.springframework.data.domain.Pageable;

public interface ServiceItemService {

    ServiceItemResponse create(ServiceItemCreateRequest request);

    ServiceItemResponse getById(String id);

    PagedResponse<ServiceItemResponse> search(ServiceItemFilterRequest filter, Pageable pageable);

    ServiceItemResponse update(String id, ServiceItemUpdateRequest request);

    void delete(String id);
}
