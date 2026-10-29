package com.kitolam.rentalroommanagement.modules.room.controller;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.response.PublicRoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.PublicRoomService;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.response.RoomTypeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicRoomController {

    private final PublicRoomService publicRoomService;

    @GetMapping("/rooms")
    public StandardResponse<PagedResponse<PublicRoomResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String branchId,
            @RequestParam(required = false) String roomTypeId,
            @RequestParam(required = false) String address,
            @RequestParam(required = false) String roomMode,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minArea,
            @RequestParam(required = false) BigDecimal maxArea,
            @RequestParam(required = false) Integer minCapacity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "roomNumber,asc") String sort
    ) {
        String effectiveKeyword = StringUtils.hasText(keyword) ? keyword : q;
        return StandardResponse.success(publicRoomService.search(
                effectiveKeyword, branchId, roomTypeId, address, roomMode, minPrice, maxPrice, minArea, maxArea, minCapacity, page, size, sort
        ));
    }

    @GetMapping("/rooms/{id}")
    public StandardResponse<PublicRoomResponse> getById(@PathVariable String id) {
        return StandardResponse.success(publicRoomService.getById(id));
    }

    @GetMapping("/room-types")
    public StandardResponse<List<RoomTypeResponse>> getRoomTypes() {
        return StandardResponse.success(publicRoomService.getPublicRoomTypes());
    }

    @GetMapping("/branches")
    public StandardResponse<List<BranchResponse>> getBranches() {
        return StandardResponse.success(publicRoomService.getPublicBranches());
    }
}
