package com.kitolam.rentalroommanagement.modules.reportrequestservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response.ReportRequestServiceItemResponse;
import org.springframework.data.domain.Pageable;

public interface ReportRequestServiceItemService {

    ReportRequestServiceItemResponse create(ReportRequestServiceItemCreateRequest request);

    ReportRequestServiceItemResponse getById(String id);

    PagedResponse<ReportRequestServiceItemResponse> search(ReportRequestServiceItemFilterRequest filter, Pageable pageable);

    ReportRequestServiceItemResponse update(String id, ReportRequestServiceItemUpdateRequest request);

    void delete(String id);
}
