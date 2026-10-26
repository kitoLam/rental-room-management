package com.kitolam.rentalroommanagement.modules.appointment.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentCreateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentFilterRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.AppointmentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse;
import com.kitolam.rentalroommanagement.modules.appointment.repository.AppointmentRepository;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;

    @Override
    public AppointmentResponse create(AppointmentCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public AppointmentResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<AppointmentResponse> search(AppointmentFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public AppointmentResponse update(String id, AppointmentUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
