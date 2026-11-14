package com.kitolam.rentalroommanagement.modules.notification.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationScope;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private static final Set<String> INBOX_KINDS = Set.of(
            "TENANT_CONTRACT", "TENANT_DEBT", "SERVICE_REQUEST_APPROVED", "SERVICE_REQUEST_COMPLETED");

    private final NotificationService notifications;
    private final Clock clock;

    @GetMapping
    public StandardResponse<PagedResponse<NotificationResponse>> list(
            @AuthenticationPrincipal AuthPrincipal principal, @RequestParam(required = false) Boolean read,
            Pageable pageable) {
        return StandardResponse.success(notifications.list(scope(principal), read, pageable));
    }

    @PostMapping("/{id}/read")
    public StandardResponse<NotificationResponse> read(
            @AuthenticationPrincipal AuthPrincipal principal, @PathVariable String id) {
        return StandardResponse.success(notifications.markRead(scope(principal), id, clock.instant()));
    }

    @PostMapping("/read-all")
    public StandardResponse<Long> readAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return StandardResponse.success(notifications.markAllRead(scope(principal), clock.instant()));
    }

    private NotificationScope scope(AuthPrincipal principal) {
        return new NotificationScope(principal.userId(), Set.of(), INBOX_KINDS);
    }
}
