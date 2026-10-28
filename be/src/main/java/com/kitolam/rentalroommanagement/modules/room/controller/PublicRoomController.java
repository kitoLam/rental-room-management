package com.kitolam.rentalroommanagement.modules.room.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.response.PublicRoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.PublicRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/public/rooms")
@RequiredArgsConstructor
public class PublicRoomController {

    private final PublicRoomService publicRoomService;

    @GetMapping
    public StandardResponse<PagedResponse<PublicRoomResponse>> search(
            @RequestParam(required = false) String branchId,
            @RequestParam(required = false) String roomTypeId,
            @RequestParam(required = false) String address,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Integer minCapacity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "code,asc") String sort
    ) {
        return StandardResponse.success(publicRoomService.search(
                branchId, roomTypeId, address, minPrice, maxPrice, minCapacity, page, size, sort
        ));
    }

    @GetMapping("/{id}")
    public StandardResponse<PublicRoomResponse> getById(@PathVariable String id) {
        return StandardResponse.success(publicRoomService.getById(id));
    }
}
