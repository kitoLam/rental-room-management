package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.PositiveOrZero;
import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.time.LocalDate;

public record AppointmentCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank @ValidObjectId String shiftId,
        @NotNull LocalDate appointmentDate,
        @NotNull @PositiveOrZero Long configurationVersion,
        @NotBlank @Size(min = 2, max = 120) String contactName,
        @NotBlank @Size(max = 32) String contactPhone,
        @NotNull(message = "Chọn ít nhất một slot để đặt lịch xem phòng")
        @Size(min = 1, max = 100, message = "Chọn từ 1 đến 100 slot trong cùng phòng")
        java.util.List<@NotBlank @ValidObjectId String> roomSlotIds
) {
    public AppointmentCreateRequest(String roomId, String shiftId, LocalDate appointmentDate, Long configurationVersion,
                                     String contactName, String contactPhone) {
        this(roomId, shiftId, appointmentDate, configurationVersion, contactName, contactPhone, java.util.List.of());
    }
    @JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Trường không được phép: " + field);
    }
}
