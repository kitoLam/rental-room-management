package com.kitolam.rentalroommanagement.modules.booking.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingCreateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingFilterRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.request.BookingUpdateRequest;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.BookingResponse;
import com.kitolam.rentalroommanagement.modules.booking.repository.BookingRepository;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;

    @Override
    public BookingResponse create(BookingCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public BookingResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<BookingResponse> search(BookingFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public BookingResponse update(String id, BookingUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
