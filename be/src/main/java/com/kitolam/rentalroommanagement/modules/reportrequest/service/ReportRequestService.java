package com.kitolam.rentalroommanagement.modules.reportrequest.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import org.springframework.data.domain.Pageable;

public interface ReportRequestService {

    ReportRequestResponse create(ReportRequestCreateRequest request);

    ReportRequestResponse getById(String id);

    PagedResponse<ReportRequestResponse> search(ReportRequestFilterRequest filter, Pageable pageable);

    ReportRequestResponse update(String id, ReportRequestUpdateRequest request);

    void delete(String id);
}
