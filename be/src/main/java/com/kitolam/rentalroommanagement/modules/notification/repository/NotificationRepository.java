package com.kitolam.rentalroommanagement.modules.notification.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.notification.document.Notification;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends BaseRepository<Notification> {
    @Query("{'_id':{$in:?0},'recipientAccountId':?1,'isDeleted':false,'readAt':null}")
    @Update("{$set:{'readAt':?2,'updatedAt':?2}}")
    long markRead(List<String> ids, String accountId, Instant at);
}
