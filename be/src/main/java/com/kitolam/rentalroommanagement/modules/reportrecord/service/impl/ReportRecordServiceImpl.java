package com.kitolam.rentalroommanagement.modules.reportrecord.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.repository.ReportRecordRepository;
import com.kitolam.rentalroommanagement.modules.reportrecord.service.ReportRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReportRecordServiceImpl implements ReportRecordService {

    private final ReportRecordRepository reportRecordRepository;

    @Override
    public ReportRecordResponse create(ReportRecordCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ReportRecordResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ReportRecordResponse> search(ReportRecordFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
