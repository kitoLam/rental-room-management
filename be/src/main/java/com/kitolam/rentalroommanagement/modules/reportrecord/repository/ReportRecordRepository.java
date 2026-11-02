package com.kitolam.rentalroommanagement.modules.reportrecord.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.reportrecord.document.ReportRecord;

import java.util.List;

public interface ReportRecordRepository extends BaseRepository<ReportRecord> {

    List<ReportRecord> findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(String reportRequestId);
}
