package com.kitolam.rentalroommanagement.modules.notification.mapper;

import com.kitolam.rentalroommanagement.modules.notification.document.Notification;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface NotificationMapper {
    NotificationResponse toResponse(Notification notification);
    @Mapping(target = "id", source = "id")
    @Mapping(target = "updatedAt", source = "request.createdAt")
    @Mapping(target = "isDeleted", constant = "false")
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "readAt", ignore = true)
    Notification toDocument(NotificationPublishRequest request, String id);
}
