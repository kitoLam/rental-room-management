package com.kitolam.rentalroommanagement.modules.appointment.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import org.springframework.data.domain.Pageable;

public interface AppointmentService {

    AppointmentResponse create(AppointmentCreateRequest request);

    AppointmentResponse getById(String id);

    PagedResponse<AppointmentResponse> search(AppointmentFilterRequest filter, Pageable pageable);

    AppointmentResponse update(String id, AppointmentUpdateRequest request);

    void delete(String id);
}
