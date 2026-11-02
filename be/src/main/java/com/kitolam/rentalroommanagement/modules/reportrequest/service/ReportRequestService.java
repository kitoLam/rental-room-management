package com.kitolam.rentalroommanagement.modules.reportrequest.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestAdminResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestEscalateAdminRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestInfoRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestProgressRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestRejectRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestReopenRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestSupplementRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import org.springframework.data.domain.Pageable;

public interface ReportRequestService {

    /**
     * Tenant tạo yêu cầu:
     * - Kiểm tra Hợp đồng có hiệu lực không.
     * - Ghi nhận yêu cầu (Mới).
     * - Tự gán Manager theo khu trọ.
     * - Lưu lịch sử ReportRecord khởi tạo.
     */
    ReportRequestResponse create(ReportRequestCreateRequest request, AuthPrincipal principal);

    /** Lấy chi tiết yêu cầu kèm toàn bộ timeline lịch sử */
    ReportRequestResponse getById(String id, AuthPrincipal principal);

    /** Tìm kiếm / lọc danh sách theo quyền của vai trò (Tenant/Manager/Admin) */
    PagedResponse<ReportRequestResponse> search(ReportRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Manager bắt đầu tiếp nhận và xử lý (chuyển PENDING sang IN_PROGRESS) */
    ReportRequestResponse startProcessing(String id, AuthPrincipal principal);

    /** Manager yêu cầu Tenant bổ sung thông tin (chuyển sang WAITING_INFO) */
    ReportRequestResponse requestInfo(String id, ReportRequestInfoRequest request, AuthPrincipal principal);

    /** Tenant bổ sung thông tin (chuyển lại PENDING) */
    ReportRequestResponse supplementInfo(String id, ReportRequestSupplementRequest request, AuthPrincipal principal);

    /** Manager từ chối yêu cầu kèm lý do (chuyển sang REJECTED) */
    ReportRequestResponse reject(String id, ReportRequestRejectRequest request, AuthPrincipal principal);

    /** Manager cập nhật tiến độ xử lý (giữ IN_PROGRESS) */
    ReportRequestResponse updateProgress(String id, ReportRequestProgressRequest request, AuthPrincipal principal);

    /** Manager hoàn thành xử lý, ghi kết quả (chuyển sang RESOLVED) */
    ReportRequestResponse resolve(String id, ReportRequestResolveRequest request, AuthPrincipal principal);

    /** Tenant xem kết quả -> hài lòng -> Xác nhận đóng yêu cầu (chuyển sang CLOSED) */
    ReportRequestResponse confirmClose(String id, AuthPrincipal principal);

    /** Tenant không hài lòng, mở lại để tiếp tục xử lý (chuyển lại IN_PROGRESS) */
    ReportRequestResponse reopen(String id, ReportRequestReopenRequest request, AuthPrincipal principal);

    /** Không giải quyết được -> Chuyển tranh chấp lên Admin xác minh (chuyển sang ESCALATED_ADMIN) */
    ReportRequestResponse escalateAdmin(String id, ReportRequestEscalateAdminRequest request, AuthPrincipal principal);

    /** Admin tiếp nhận tranh chấp, xác minh và ghi nhận kết luận giải quyết (chuyển sang CLOSED) */
    ReportRequestResponse adminResolve(String id, ReportRequestAdminResolveRequest request, AuthPrincipal principal);

    /** Tenant tự hủy yêu cầu khi chưa xử lý (từ PENDING hoặc WAITING_INFO sang CANCELLED) */
    ReportRequestResponse cancel(String id, AuthPrincipal principal);

    /** Cập nhật thông tin chung (PATCH) */
    ReportRequestResponse update(String id, ReportRequestUpdateRequest request, AuthPrincipal principal);

    /** Xóa mềm yêu cầu */
    void delete(String id, AuthPrincipal principal);
}
