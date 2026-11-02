package com.kitolam.rentalroommanagement.modules.reportrecord.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.reportrecord.document.ReportRecord;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.request.ReportRecordFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.repository.ReportRecordRepository;
import com.kitolam.rentalroommanagement.modules.reportrecord.service.ReportRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportRecordServiceImpl implements ReportRecordService {

    private final ReportRecordRepository reportRecordRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public ReportRecordResponse create(ReportRecordCreateRequest request) {
        ReportRecord record = new ReportRecord();
        record.setReportRequestId(request.reportRequestId());
        record.setActorId(request.actorId());
        record.setActorRole(request.actorRole());
        record.setActorName(request.actorName());
        record.setManagerId(request.managerId());
        record.setAction(request.action());
        record.setStatusFrom(request.statusFrom());
        record.setStatusTo(request.statusTo());
        record.setNote(request.note());
        if (request.attachments() != null) {
            record.setAttachments(request.attachments());
        }

        ReportRecord saved = reportRecordRepository.save(record);
        return ReportRecordResponse.from(saved);
    }

    @Override
    public ReportRecordResponse getById(String id) {
        ReportRecord record = reportRecordRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nhật ký xử lý với id: " + id));
        return ReportRecordResponse.from(record);
    }

    @Override
    public List<ReportRecordResponse> getByReportRequestId(String reportRequestId) {
        List<ReportRecord> records = reportRecordRepository
                .findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportRequestId);
        return records.stream().map(ReportRecordResponse::from).toList();
    }

    @Override
    public PagedResponse<ReportRecordResponse> search(ReportRecordFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (filter != null) {
            MongoQueryHelper.addObjectIdEquals(criteria, "reportRequestId", filter.reportRequestId());
            MongoQueryHelper.addObjectIdEquals(criteria, "managerId", filter.managerId());
            MongoQueryHelper.addObjectIdEquals(criteria, "actorId", filter.actorId());
            MongoQueryHelper.addEquals(criteria, "action", filter.action());
            MongoQueryHelper.addEquals(criteria, "statusFrom", filter.statusFrom());
            MongoQueryHelper.addEquals(criteria, "statusTo", filter.statusTo());
        }

        Page<ReportRecord> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, ReportRecord.class);
        return PagedResponse.from(page.map(ReportRecordResponse::from));
    }

    @Override
    public void delete(String id) {
        ReportRecord record = reportRecordRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nhật ký xử lý với id: " + id));
        record.markDeleted();
        reportRecordRepository.save(record);
    }
}
