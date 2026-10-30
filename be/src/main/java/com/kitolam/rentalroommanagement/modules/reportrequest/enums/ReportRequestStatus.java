package com.kitolam.rentalroommanagement.modules.reportrequest.enums;

public enum ReportRequestStatus {
    PENDING,        // Mới tạo, hệ thống đã gán Manager, chờ tiếp nhận
    WAITING_INFO,   // Chờ Tenant bổ sung thông tin
    IN_PROGRESS,    // Manager đã tiếp nhận / Đang xử lý
    RESOLVED,       // Đã giải quyết, gửi kết quả cho Tenant
    REJECTED,       // Manager từ chối kèm lý do
    CLOSED,         // Đã đóng / Lưu hồ sơ (Tenant hài lòng hoặc Admin đóng)
    ESCALATED_ADMIN,// Tranh chấp không tự hòa giải được, chuyển Admin
    CANCELLED       // Tenant tự hủy yêu cầu
}
