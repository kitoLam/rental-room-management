package com.kitolam.rentalroommanagement.modules.reportrecord.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import org.springframework.data.domain.Pageable;

public interface ReportRecordService {

    ReportRecordResponse create(ReportRecordCreateRequest request);

    ReportRecordResponse getById(String id);

    PagedResponse<ReportRecordResponse> search(ReportRecordFilterRequest filter, Pageable pageable);

    void delete(String id);
}
