package com.kitolam.rentalroommanagement.modules.servicerequest.service.support;

import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.servicerequest.document.ServiceRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * One place for service request notification content and audience.
 * Notifications are sent after the business write commits; a delivery failure never undoes the decision.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ServiceRequestNotificationSupport {

    private static final String TENANT_PATH = "/tenant/services";
    private static final String MANAGER_PATH = "/manager/service-requests";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NotificationService notifications;
    private final ServiceRequestAccessSupport access;

    /** Tenant sent a new request: notify the branch's managers and owner. */
    public void submitted(ServiceRequest request, Instant at) {
        String title = request.getAction() == ServiceRequestAction.REGISTER
                ? "Có yêu cầu đăng ký dịch vụ mới" : "Có yêu cầu ngừng dịch vụ mới";
        String message = summary(request) + " · Đề nghị ngày " + DATE.format(request.getProposedDate());
        toManagers(request, "SUBMITTED", title, message, at);
    }

    public void cancelled(ServiceRequest request, Instant at) {
        toManagers(request, "CANCELLED", "Người thuê đã hủy yêu cầu dịch vụ", summary(request), at);
    }

    public void approved(ServiceRequest request, Instant at) {
        toTenant(request, "APPROVED", "Yêu cầu đăng ký dịch vụ đã được duyệt",
                summary(request) + " · Quản lý sẽ xác nhận ngày lắp đặt", at);
    }

    public void rejected(ServiceRequest request, Instant at) {
        toTenant(request, "REJECTED", "Yêu cầu dịch vụ bị từ chối",
                summary(request) + " · Lý do: " + request.getRejectReason(), at);
    }

    public void completed(ServiceRequest request, Instant at) {
        boolean register = request.getAction() == ServiceRequestAction.REGISTER;
        String title = register ? "Dịch vụ đã được xác nhận lắp đặt" : "Dịch vụ đã được xác nhận ngừng";
        String message = summary(request) + (register ? " · Bắt đầu tính phí từ " : " · Ngừng tính phí từ ")
                + DATE.format(request.getConfirmedDate());
        toTenant(request, "COMPLETED", title, message, at);
    }

    private void toManagers(ServiceRequest request, String kind, String title, String message, Instant at) {
        try {
            Set<String> recipients = access.managementRecipients(request.getBranchId());
            publishAfterCommit(recipients.stream()
                    .map(recipient -> publication(request, kind, recipient, title, message, MANAGER_PATH, at)).toList());
        } catch (RuntimeException unavailable) {
            log.warn("Skipped service request notification lookup for branch {}", request.getBranchId());
        }
    }

    private void toTenant(ServiceRequest request, String kind, String title, String message, Instant at) {
        publishAfterCommit(List.of(publication(request, kind, request.getRequesterAccountId(), title, message, TENANT_PATH, at)));
    }

    private NotificationPublishRequest publication(ServiceRequest request, String kind, String recipient,
                                                   String title, String message, String path, Instant at) {
        // eventId is unique per request and step, so a retried call never notifies twice.
        String eventId = "SERVICE_REQUEST:" + request.getId() + ":" + kind;
        return new NotificationPublishRequest(eventId, recipient, request.getRequesterAccountId(), null,
                request.getBranchId(), "SERVICE_REQUEST_" + kind, title, message, path, at);
    }

    private String summary(ServiceRequest request) {
        String target = request.getSlotCode() != null ? "Chỗ " + request.getSlotCode() : "Phòng " + request.getRoomNumber();
        return request.getServiceName() + " · " + target;
    }

    private void publishAfterCommit(Collection<NotificationPublishRequest> publications) {
        if (publications.isEmpty()) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publications.forEach(ServiceRequestNotificationSupport.this::publishQuietly);
                }
            });
        } else {
            publications.forEach(this::publishQuietly);
        }
    }

    private void publishQuietly(NotificationPublishRequest publication) {
        try {
            notifications.publish(publication);
        } catch (RuntimeException failed) {
            log.warn("Service request notification failed event={}", publication.eventId());
        }
    }
}
