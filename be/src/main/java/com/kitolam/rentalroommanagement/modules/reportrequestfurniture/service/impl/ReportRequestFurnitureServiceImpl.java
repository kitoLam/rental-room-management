package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response.ReportRequestFurnitureResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.repository.ReportRequestFurnitureRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service.ReportRequestFurnitureService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReportRequestFurnitureServiceImpl implements ReportRequestFurnitureService {

    private final ReportRequestFurnitureRepository reportRequestFurnitureRepository;

    @Override
    public ReportRequestFurnitureResponse create(ReportRequestFurnitureCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestFurnitureResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ReportRequestFurnitureResponse> search(ReportRequestFurnitureFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestFurnitureResponse update(String id, ReportRequestFurnitureUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
