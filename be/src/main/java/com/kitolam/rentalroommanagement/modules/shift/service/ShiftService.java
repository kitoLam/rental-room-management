package com.kitolam.rentalroommanagement.modules.shift.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftCreateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftFilterRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import org.springframework.data.domain.Pageable;

public interface ShiftService {

    ShiftResponse create(ShiftCreateRequest request);

    ShiftResponse getById(String id);

    PagedResponse<ShiftResponse> search(ShiftFilterRequest filter, Pageable pageable);

    ShiftResponse update(String id, ShiftUpdateRequest request);

    void delete(String id);
}
