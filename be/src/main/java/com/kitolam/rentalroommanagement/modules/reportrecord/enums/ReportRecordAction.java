package com.kitolam.rentalroommanagement.modules.reportrecord.enums;

public enum ReportRecordAction {
    CREATED,            // Tạo yêu cầu mới
    ASSIGNED,           // Gán Manager phụ trách
    STATUS_CHANGED,     // Thay đổi trạng thái chung
    COMMENTED,          // Bình luận / phản hồi trao đổi
    REQUESTED_INFO,     // Manager yêu cầu bổ sung thông tin
    INFO_SUPPLEMENTED,  // Tenant bổ sung thông tin
    PROGRESS_UPDATED,   // Cập nhật tiến độ xử lý
    RESOLVED,           // Manager ghi nhận kết quả đã giải quyết
    REJECTED,           // Manager từ chối kèm lý do
    CLOSED,             // Tenant xác nhận hài lòng / Đã đóng
    REOPENED,           // Mở lại yêu cầu để tiếp tục xử lý
    ESCALATED_ADMIN,    // Chuyển Admin phân xử tranh chấp
    ADMIN_RESOLVED,     // Admin xác minh và đưa ra kết luận
    CANCELLED           // Hủy yêu cầu
}
