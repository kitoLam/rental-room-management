package com.kitolam.rentalroommanagement.modules.reportrequestservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.document.ReportRequestServiceItem;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request.ReportRequestServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.response.ReportRequestServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.repository.ReportRequestServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.service.ReportRequestServiceItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceItemServiceImpl implements ReportRequestServiceItemService {

    private final ReportRequestServiceItemRepository reportRequestServiceItemRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public ReportRequestServiceItemResponse create(ReportRequestServiceItemCreateRequest request) {
        ReportRequestServiceItem entity = new ReportRequestServiceItem();
        entity.setReportRequestId(request.reportRequestId());
        entity.setRoomServiceId(request.roomServiceId());
        entity.setNote(request.note());

        ReportRequestServiceItem saved = reportRequestServiceItemRepository.save(entity);
        return ReportRequestServiceItemResponse.from(saved);
    }

    @Override
    public ReportRequestServiceItemResponse getById(String id) {
        ReportRequestServiceItem entity = reportRequestServiceItemRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ liên kết báo cáo với id: " + id));
        return ReportRequestServiceItemResponse.from(entity);
    }

    @Override
    public PagedResponse<ReportRequestServiceItemResponse> search(ReportRequestServiceItemFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (filter != null) {
            MongoQueryHelper.addObjectIdEquals(criteria, "reportRequestId", filter.reportRequestId());
            MongoQueryHelper.addObjectIdEquals(criteria, "roomServiceId", filter.roomServiceId());
        }

        Page<ReportRequestServiceItem> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, ReportRequestServiceItem.class);
        return PagedResponse.from(page.map(ReportRequestServiceItemResponse::from));
    }

    @Override
    public ReportRequestServiceItemResponse update(String id, ReportRequestServiceItemUpdateRequest request) {
        ReportRequestServiceItem entity = reportRequestServiceItemRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ liên kết báo cáo với id: " + id));

        if (StringUtils.hasText(request.note())) {
            entity.setNote(request.note());
        }

        ReportRequestServiceItem updated = reportRequestServiceItemRepository.save(entity);
        return ReportRequestServiceItemResponse.from(updated);
    }

    @Override
    public void delete(String id) {
        ReportRequestServiceItem entity = reportRequestServiceItemRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ liên kết báo cáo với id: " + id));
        entity.markDeleted();
        reportRequestServiceItemRepository.save(entity);
    }
}
