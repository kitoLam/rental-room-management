package com.kitolam.rentalroommanagement.modules.appointment.service.support;

import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** One place for viewing notification content, audience and durable recipient-lookup failures. */
@Component
@RequiredArgsConstructor
@Slf4j
public class AppointmentNotificationSupport {
    private final AppointmentAccessService access;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    public Set<String> managementRecipients(String branchId, String excluded) {
        Set<String> result = new LinkedHashSet<>();
        access.managementAccounts(branchId).stream().filter(a -> a.canManage(branchId))
                .map(a -> a.accountId()).filter(id -> !id.equals(excluded)).forEach(result::add);
        return result;
    }

    public Plan plan(Appointment appointment, String eventId, String kind, Instant at, String excluded, String reason) {
        String title = switch (kind) {
            case "CREATED" -> "Có yêu cầu xem phòng mới";
            case "APPROVED" -> "Lịch xem phòng đã được duyệt";
            case "REJECTED" -> "Yêu cầu xem phòng đã bị từ chối";
            case "CANCELLED", "TENANT_CANCELLED", "SYSTEM_CANCELLED" -> "Lịch xem phòng đã bị hủy";
            case "EXPIRED" -> "Yêu cầu xem phòng đã hết hạn";
            case "COMPLETED" -> "Đã ghi nhận xem phòng hoàn tất";
            case "NO_SHOW" -> "Đã ghi nhận không đến xem phòng";
            case "RESULT_CORRECTED" -> "Kết quả hoặc ghi chú xem phòng đã được sửa";
            case "REMIND_APPROVAL" -> "Nhắc duyệt lịch xem: còn tối đa một giờ";
            case "REMIND_VIEWING" -> "Nhắc lịch xem phòng: sắp đến giờ hẹn";
            default -> "Cập nhật lịch xem phòng";
        };
        String period = appointment.getShiftType() == null ? "Ca đã hẹn" : switch (appointment.getShiftType()) {
            case MORNING -> "Ca sáng"; case AFTERNOON -> "Ca chiều"; case EVENING -> "Ca tối";
        };
        String hours = appointment.getStartAt() == null ? String.valueOf(appointment.getAppointmentDate())
                : TIME.format(appointment.getStartAt()) + (appointment.getEndAt() == null ? "" : " → " + TIME.format(appointment.getEndAt()));
        String message = appointment.getRoomNumber() + " · " + appointment.getBranchName() + " · " + period + " · " + hours
                + " · " + title + (reason == null || reason.isBlank() ? "" : " · " + reason);
        Set<String> recipients = new LinkedHashSet<>();
        List<Appointment.NotificationRecipientRetry> retries = new ArrayList<>();
        boolean managers = Set.of("CREATED", "TENANT_CANCELLED", "SYSTEM_CANCELLED", "EXPIRED", "REMIND_APPROVAL").contains(kind);
        boolean requester = !Set.of("CREATED", "TENANT_CANCELLED", "REMIND_APPROVAL").contains(kind);
        if (managers && appointment.getBranchId() != null) {
            try { recipients.addAll(managementRecipients(appointment.getBranchId(), excluded)); }
            catch (RuntimeException unavailable) {
                log.warn("Deferred viewing notification recipient lookup for branch {}", appointment.getBranchId());
                retries.add(new Appointment.NotificationRecipientRetry(eventId, appointment.getBranchId(), excluded, title, message, at, kind));
            }
        }
        if (requester && appointment.getRequesterAccountId() != null) recipients.add(appointment.getRequesterAccountId());
        recipients.remove(excluded);
        return new Plan(recipients.stream().map(id -> new Appointment.NotificationIntent(eventId, id, title, message, at, kind)).toList(), retries);
    }

    public record Plan(List<Appointment.NotificationIntent> intents, List<Appointment.NotificationRecipientRetry> retries) {
        public void applyTo(Appointment appointment) {
            appointment.setNotificationIntents(new ArrayList<>(intents));
            appointment.setNotificationRecipientRetries(new ArrayList<>(retries));
        }
        public void appendTo(Update update) {
            if (!intents.isEmpty()) update.push("notificationIntents").each(intents.toArray());
            if (!retries.isEmpty()) update.push("notificationRecipientRetries").each(retries.toArray());
        }
    }
}
