package com.kitolam.rentalroommanagement.modules.manager.mapper;

@org.mapstruct.Mapper(componentModel = "spring")
public interface ManagerMapper {
    com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse toResponse(
            com.kitolam.rentalroommanagement.modules.manager.document.Manager manager);
}
