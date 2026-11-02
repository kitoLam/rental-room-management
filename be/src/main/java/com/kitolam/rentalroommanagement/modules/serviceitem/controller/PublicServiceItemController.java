package com.kitolam.rentalroommanagement.modules.serviceitem.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.EnumSet;
import java.util.List;

/** Read-only catalog for the room detail page ("Dịch vụ tham khảo"); no login required. */
@RestController
@RequestMapping("/api/v1/public/services")
@RequiredArgsConstructor
@Tag(name = "Public services")
public class PublicServiceItemController {

    private final ServiceItemService serviceItemService;

    @GetMapping
    @Operation(summary = "Dịch vụ đang cung cấp cho phòng thuê nguyên phòng (ROOM) hoặc theo chỗ (SLOT)")
    public StandardResponse<List<ServiceItemResponse>> list(@RequestParam(defaultValue = "ROOM") ServiceScope roomMode) {
        // A slot tenant also shares the room-level services, same rule as the service request catalog.
        EnumSet<ServiceScope> scopes = roomMode == ServiceScope.SLOT ? EnumSet.allOf(ServiceScope.class) : EnumSet.of(ServiceScope.ROOM);
        return StandardResponse.success(serviceItemService.listPublic(scopes));
    }
}
