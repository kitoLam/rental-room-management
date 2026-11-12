package com.kitolam.rentalroommanagement.modules.notification.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationScope;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import com.kitolam.rentalroommanagement.modules.notification.mapper.NotificationMapper;
import com.kitolam.rentalroommanagement.modules.notification.repository.NotificationRepository;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository repository;
    private final NotificationMapper mapper;

    @Override
    public void publish(NotificationPublishRequest request) {
        // The primary key enforces deduplication even when automatic index creation is disabled.
        String id = key(request.appointmentId() + "\u0000" + request.eventId() + "\u0000" + request.recipientAccountId());
        if (repository.existsById(id)) return;
        try { repository.insert(mapper.toDocument(request, id)); }
        catch (DuplicateKeyException concurrentDelivery) {
            // Outside a transaction this is a successful replay. In a Mongo transaction the caller
            // must retry the whole transaction, since a duplicate-key write aborts that transaction.
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) throw concurrentDelivery;
        }
    }

    @Override
    public PagedResponse<NotificationResponse> list(NotificationScope scope, Boolean read, Pageable pageable) {
        Criteria criteria = scope(scope);
        if (read != null) criteria = new Criteria().andOperator(criteria, read ? Criteria.where("readAt").ne(null) : Criteria.where("readAt").is(null));
        var paging = PageRequest.of(pageable.getPageNumber(), Math.min(Math.max(pageable.getPageSize(), 1), 100), Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return PagedResponse.from(repository.findWithPagination(criteria, paging), mapper::toResponse);
    }

    @Override
    public NotificationResponse markRead(NotificationScope scope, String id, Instant at) {
        var page = repository.findWithPagination(new Criteria().andOperator(scope(scope), Criteria.where("id").is(id)), PageRequest.of(0, 1));
        var notification = page.stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy thông báo trong phạm vi tài khoản"));
        repository.markRead(List.of(id), scope.accountId(), at);
        return mapper.toResponse(repository.findByIdAndIsDeletedFalse(notification.getId()).orElseThrow());
    }

    @Override
    public long markAllRead(NotificationScope scope, Instant at) {
        long count = 0;
        while (true) {
            var unread = repository.findWithPagination(new Criteria().andOperator(scope(scope), Criteria.where("readAt").is(null),
                    Criteria.where("createdAt").lte(at)), PageRequest.of(0, 100));
            if (unread.isEmpty()) return count;
            count += repository.markRead(unread.stream().map(n -> n.getId()).toList(), scope.accountId(), at);
        }
    }

    private Criteria scope(NotificationScope scope) {
        var branches = scope.manageableBranchIds().stream().map(MongoQueryHelper::toObjectId).toList();
        return new Criteria().andOperator(Criteria.where("recipientAccountId").is(scope.accountId()),
                new Criteria().orOperator(Criteria.where("requesterAccountId").is(scope.accountId()), Criteria.where("branchId").in(branches)));
    }

    private String key(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
