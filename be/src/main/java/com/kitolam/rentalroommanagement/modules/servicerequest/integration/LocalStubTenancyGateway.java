package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import com.kitolam.rentalroommanagement.common.exception.exceptions.InternalServerErrorException;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Optional;

/**
 * LOCAL DEVELOPMENT ONLY: every tenant is treated as renting the configured room (and slot)
 * so the service flow can be tested before the contract module is merged.
 * Room and branch data come from their modules' public services.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "service-request.tenancy-stub", name = "enabled", havingValue = "true")
public class LocalStubTenancyGateway implements TenancyGateway {

    private final RoomService rooms;
    private final BranchService branches;
    private final String roomId;
    private final String roomSlotId;

    public LocalStubTenancyGateway(RoomService rooms, BranchService branches,
                                   @Value("${service-request.tenancy-stub.room-id:}") String roomId,
                                   @Value("${service-request.tenancy-stub.room-slot-id:}") String roomSlotId) {
        this.rooms = rooms;
        this.branches = branches;
        this.roomId = roomId;
        this.roomSlotId = StringUtils.hasText(roomSlotId) ? roomSlotId : null;
        log.warn("Service request tenancy stub is enabled: every tenant rents room {} (local development only)", roomId);
    }

    @Override
    public Optional<ActiveTenancySnapshot> findActiveTenancy(String tenantId, String accountEmail, LocalDate onDate) {
        if (!StringUtils.hasText(roomId)) {
            throw new InternalServerErrorException("Chưa cấu hình SERVICE_REQUEST_TENANCY_STUB_ROOM_ID");
        }
        RoomResponse room = rooms.getById(roomId);
        String branchName = branches.getById(room.branchId()).name();
        return Optional.of(new ActiveTenancySnapshot(tenantId, null, null, true, room.branchId(), branchName,
                room.id(), room.roomNumber(), roomSlotId, null, onDate.minusMonths(1), onDate.plusYears(1)));
    }
}
