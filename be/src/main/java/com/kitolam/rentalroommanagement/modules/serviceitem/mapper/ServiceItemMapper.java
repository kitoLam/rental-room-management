package com.kitolam.rentalroommanagement.modules.serviceitem.mapper;

import com.kitolam.rentalroommanagement.modules.serviceitem.document.ServiceItem;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemUpdateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ServiceItemMapper {

    ServiceItemResponse toResponse(ServiceItem serviceItem);

    /** Code is normalized by the service; status starts as ACTIVE. */
    @Mapping(target = "code", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "isDeleted", ignore = true)
    ServiceItem toDocument(ServiceItemCreateRequest request);

    /** PATCH semantics: null fields keep the current value. Code is immutable. */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "code", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "isDeleted", ignore = true)
    void update(ServiceItemUpdateRequest request, @MappingTarget ServiceItem serviceItem);
}
