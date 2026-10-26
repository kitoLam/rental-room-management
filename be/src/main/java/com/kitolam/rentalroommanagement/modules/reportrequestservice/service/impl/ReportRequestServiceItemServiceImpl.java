package com.kitolam.rentalroommanagement.modules.reportrequestservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response.ReportRequestServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.repository.ReportRequestServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.service.ReportRequestServiceItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceItemServiceImpl implements ReportRequestServiceItemService {

    private final ReportRequestServiceItemRepository reportRequestServiceItemRepository;

    @Override
    public ReportRequestServiceItemResponse create(ReportRequestServiceItemCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestServiceItemResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ReportRequestServiceItemResponse> search(ReportRequestServiceItemFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestServiceItemResponse update(String id, ReportRequestServiceItemUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
