package com.kitolam.rentalroommanagement.modules.serviceitem.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Set;

public interface ServiceItemService {

    ServiceItemResponse create(ServiceItemCreateRequest request);

    ServiceItemResponse getById(String id);

    PagedResponse<ServiceItemResponse> search(ServiceItemFilterRequest filter, Pageable pageable);

    ServiceItemResponse update(String id, ServiceItemUpdateRequest request);

    void delete(String id);

    /** Internal: catalog entry that can still be registered (exists and ACTIVE). */
    ServiceItemResponse requireActive(String id);

    /** Internal: ACTIVE optional services of the given scopes. Metered utilities are configured per room, not registered. */
    List<ServiceItemResponse> listSubscribable(Set<ServiceScope> scopes);
}
