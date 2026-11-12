package com.kitolam.rentalroommanagement.modules.notification.dto.request;

import java.time.Instant;

/** Trusted in-process contract. No HTTP endpoint accepts publication or recipient identities. */
public record NotificationPublishRequest(String eventId, String recipientAccountId, String requesterAccountId,
        String appointmentId, String branchId, String kind, String title, String message,
        String detailPath, Instant createdAt) { }
