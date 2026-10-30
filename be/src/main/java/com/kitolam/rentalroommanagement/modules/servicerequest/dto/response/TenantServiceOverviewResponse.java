package com.kitolam.rentalroommanagement.modules.servicerequest.dto.response;

import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceDisplayStatus;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestOperation;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** One catalog service as seen by the tenant: current subscription, open request and allowed actions. */
public record TenantServiceOverviewResponse(
        String serviceId,
        String code,
        String name,
        String unit,
        BigDecimal unitPrice,
        CalculationType calculationType,
        ServiceScope scope,
        Subscription subscription,
        OpenRequest openRequest,
        ServiceDisplayStatus displayStatus,
        List<ServiceRequestOperation> allowedActions
) {
    public record Subscription(String id, String serviceId, ServiceScope scope, String status,
                               LocalDate startDate, LocalDate endDate, BigDecimal unitPrice, Integer quantity) {
    }

    public record OpenRequest(String id, ServiceRequestAction action, ServiceRequestStatus status, LocalDate proposedDate) {
    }
}
