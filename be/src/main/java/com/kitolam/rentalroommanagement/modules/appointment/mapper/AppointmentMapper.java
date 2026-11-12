package com.kitolam.rentalroommanagement.modules.appointment.mapper;

import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import org.mapstruct.IterableMapping;
import org.mapstruct.NullValueMappingStrategy;
import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface AppointmentMapper {
    @Mapping(target = "allowedActions", source = "allowedActions")
    AppointmentResponse toResponse(Appointment appointment, List<String> allowedActions);

    @Mapping(target = "status", source = "after")
    AppointmentResponse.HistoryItem toHistory(Appointment.HistoryEntry entry);
    @IterableMapping(nullValueMappingStrategy = NullValueMappingStrategy.RETURN_DEFAULT)
    List<AppointmentResponse.HistoryItem> toHistoryList(List<Appointment.HistoryEntry> entries);
}
