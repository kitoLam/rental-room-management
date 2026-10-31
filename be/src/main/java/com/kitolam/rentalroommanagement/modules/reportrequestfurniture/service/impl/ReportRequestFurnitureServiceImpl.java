package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.document.ReportRequestFurniture;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.request.ReportRequestFurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.dto.response.ReportRequestFurnitureResponse;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.repository.ReportRequestFurnitureRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.service.ReportRequestFurnitureService;
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
public class ReportRequestFurnitureServiceImpl implements ReportRequestFurnitureService {

    private final ReportRequestFurnitureRepository reportRequestFurnitureRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public ReportRequestFurnitureResponse create(ReportRequestFurnitureCreateRequest request) {
        ReportRequestFurniture entity = new ReportRequestFurniture();
        entity.setReportRequestId(request.reportRequestId());
        entity.setFurnitureId(request.furnitureId());
        entity.setIssueDescription(request.issueDescription());

        ReportRequestFurniture saved = reportRequestFurnitureRepository.save(entity);
        return ReportRequestFurnitureResponse.from(saved);
    }

    @Override
    public ReportRequestFurnitureResponse getById(String id) {
        ReportRequestFurniture entity = reportRequestFurnitureRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đồ đạc liên kết báo cáo với id: " + id));
        return ReportRequestFurnitureResponse.from(entity);
    }

    @Override
    public PagedResponse<ReportRequestFurnitureResponse> search(ReportRequestFurnitureFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (filter != null) {
            MongoQueryHelper.addObjectIdEquals(criteria, "reportRequestId", filter.reportRequestId());
            MongoQueryHelper.addObjectIdEquals(criteria, "furnitureId", filter.furnitureId());
        }

        Page<ReportRequestFurniture> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, ReportRequestFurniture.class);
        return PagedResponse.from(page.map(ReportRequestFurnitureResponse::from));
    }

    @Override
    public ReportRequestFurnitureResponse update(String id, ReportRequestFurnitureUpdateRequest request) {
        ReportRequestFurniture entity = reportRequestFurnitureRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đồ đạc liên kết báo cáo với id: " + id));

        if (StringUtils.hasText(request.issueDescription())) {
            entity.setIssueDescription(request.issueDescription());
        }

        ReportRequestFurniture updated = reportRequestFurnitureRepository.save(entity);
        return ReportRequestFurnitureResponse.from(updated);
    }

    @Override
    public void delete(String id) {
        ReportRequestFurniture entity = reportRequestFurnitureRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đồ đạc liên kết báo cáo với id: " + id));
        entity.markDeleted();
        reportRequestFurnitureRepository.save(entity);
    }
}
