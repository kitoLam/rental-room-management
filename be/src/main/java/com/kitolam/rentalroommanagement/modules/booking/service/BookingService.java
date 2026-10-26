package com.kitolam.rentalroommanagement.modules.booking.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import org.springframework.data.domain.Pageable;

public interface BookingService {

    BookingResponse create(BookingCreateRequest request);

    BookingResponse getById(String id);

    PagedResponse<BookingResponse> search(BookingFilterRequest filter, Pageable pageable);

    BookingResponse update(String id, BookingUpdateRequest request);

    void delete(String id);
}
