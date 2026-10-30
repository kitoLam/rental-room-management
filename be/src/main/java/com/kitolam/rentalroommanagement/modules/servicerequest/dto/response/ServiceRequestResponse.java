package com.kitolam.rentalroommanagement.modules.servicerequest.dto.response;

import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestOperation;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ServiceRequestResponse(
        String id,
        ServiceRequestAction action,
        ServiceRequestStatus status,
        String serviceId,
        String serviceName,
        ServiceScope scope,
        BigDecimal unitPrice,
        Integer quantity,
        String tenantId,
        String tenantName,
        String contractTenantId,
        String branchId,
        String roomId,
        String roomNumber,
        String roomSlotId,
        String slotCode,
        String subscriptionId,
        LocalDate proposedDate,
        LocalDate confirmedDate,
        String note,
        String rejectReason,
        Instant processedAt,
        Instant createdAt,
        Instant updatedAt,
        List<HistoryItem> history,
        List<ServiceRequestOperation> allowedActions
) {
    public record HistoryItem(ServiceRequestStatus statusFrom, ServiceRequestStatus statusTo, String note, Instant at) {
    }
}
