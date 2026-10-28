package com.kitolam.rentalroommanagement.modules.notification.dto.response;

import java.time.Instant;

public record NotificationResponse(String id, String appointmentId, String kind, String title,
        String message, String detailPath, Instant createdAt, Instant readAt) { }
