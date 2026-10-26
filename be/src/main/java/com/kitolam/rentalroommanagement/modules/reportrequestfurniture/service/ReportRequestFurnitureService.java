package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response.ReportRequestFurnitureResponse;
import org.springframework.data.domain.Pageable;

public interface ReportRequestFurnitureService {

    ReportRequestFurnitureResponse create(ReportRequestFurnitureCreateRequest request);

    ReportRequestFurnitureResponse getById(String id);

    PagedResponse<ReportRequestFurnitureResponse> search(ReportRequestFurnitureFilterRequest filter, Pageable pageable);

    ReportRequestFurnitureResponse update(String id, ReportRequestFurnitureUpdateRequest request);

    void delete(String id);
}
