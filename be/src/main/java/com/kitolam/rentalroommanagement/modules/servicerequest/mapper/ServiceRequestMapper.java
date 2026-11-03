package com.kitolam.rentalroommanagement.modules.servicerequest.mapper;

import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.document.ServiceRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceTenancyResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.TenantServiceOverviewResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceDisplayStatus;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestOperation;
import com.kitolam.rentalroommanagement.modules.servicerequest.integration.ActiveTenancySnapshot;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ServiceRequestMapper {

    @Mapping(target = "allowedActions", source = "allowedActions")
    ServiceRequestResponse toResponse(ServiceRequest request, List<ServiceRequestOperation> allowedActions);

    ServiceRequestResponse.HistoryItem toHistory(ServiceRequest.HistoryEntry entry);

    TenantServiceOverviewResponse.OpenRequest toOpenRequest(ServiceRequest request);

    @Mapping(target = "scope", constant = "ROOM")
    @Mapping(target = "quantity", constant = "1")
    TenantServiceOverviewResponse.Subscription toSubscription(RoomServiceResponse subscription);

    @Mapping(target = "scope", constant = "SLOT")
    TenantServiceOverviewResponse.Subscription toSubscription(SlotServiceResponse subscription);

    @Mapping(target = "serviceId", source = "service.id")
    @Mapping(target = "code", source = "service.code")
    @Mapping(target = "name", source = "service.name")
    @Mapping(target = "unit", source = "service.unit")
    @Mapping(target = "unitPrice", source = "service.unitPrice")
    @Mapping(target = "calculationType", source = "service.calculationType")
    @Mapping(target = "scope", source = "service.scope")
    @Mapping(target = "subscription", source = "subscription")
    @Mapping(target = "openRequest", source = "openRequest")
    @Mapping(target = "displayStatus", source = "displayStatus")
    @Mapping(target = "allowedActions", source = "allowedActions")
    TenantServiceOverviewResponse toOverview(ServiceItemResponse service,
                                             TenantServiceOverviewResponse.Subscription subscription,
                                             TenantServiceOverviewResponse.OpenRequest openRequest,
                                             ServiceDisplayStatus displayStatus,
                                             List<ServiceRequestOperation> allowedActions);

    ServiceTenancyResponse toTenancy(ActiveTenancySnapshot tenancy);
}
