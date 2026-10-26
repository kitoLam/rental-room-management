package com.kitolam.rentalroommanagement.modules.reportrequest.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.repository.ReportRequestRepository;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceImpl implements ReportRequestService {

    private final ReportRequestRepository reportRequestRepository;

    @Override
    public ReportRequestResponse create(ReportRequestCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ReportRequestResponse> search(ReportRequestFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRequestResponse update(String id, ReportRequestUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
