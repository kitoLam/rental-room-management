package com.kitolam.rentalroommanagement.modules.reportrequest.enums;

public enum ReportRequestStatus {
    PENDING,        // Mới tạo, hệ thống đã gán Manager, chờ tiếp nhận
    WAITING_INFO,   // Chờ Tenant bổ sung thông tin
    IN_PROGRESS,    // Manager đã tiếp nhận / Đang xử lý
    RESOLVED,       // Đã giải quyết, gửi kết quả cho Tenant
    REJECTED,       // Manager từ chối kèm lý do
    CLOSED,         // Đã đóng / Lưu hồ sơ (Tenant hài lòng)
    CANCELLED       // Tenant tự hủy yêu cầu
}
