package com.kitolam.rentalroommanagement.modules.notification.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationScope;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import org.springframework.data.domain.Pageable;
import java.time.Instant;

public interface NotificationService {
    void publish(NotificationPublishRequest request);
    PagedResponse<NotificationResponse> list(NotificationScope scope, Boolean read, Pageable pageable);
    NotificationResponse markRead(NotificationScope scope, String id, Instant at);
    long markAllRead(NotificationScope scope, Instant at);
}
