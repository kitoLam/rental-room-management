package com.kitolam.rentalroommanagement.modules.servicerequest.integration;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.response.RoomSlotResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.Optional;

/**
 * Default tenancy source: the tenant's ACTIVE contract covering the given date (latest start wins).
 * Reads contract, room, slot and branch data only through their modules' public services.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "service-request.tenancy-stub", name = "enabled", havingValue = "false", matchIfMissing = true)
public class ContractTenancyGateway implements TenancyGateway {

    private static final int MAX_ACTIVE_CONTRACTS = 20;
    private static final int MAX_SLOTS_PER_ROOM = 100;

    private final ContractService contracts;
    private final RoomService rooms;
    private final RoomSlotService roomSlots;
    private final BranchService branches;

    @Override
    public Optional<ActiveTenancySnapshot> findActiveTenancy(AuthPrincipal principal, String tenantId, LocalDate onDate) {
        ContractFilterRequest filter = new ContractFilterRequest(null, null, ContractStatus.ACTIVE, null);
        PageRequest page = PageRequest.of(0, MAX_ACTIVE_CONTRACTS, Sort.by(Sort.Direction.DESC, "startDate"));
        return contracts.search(filter, page, principal).getContent().stream()
                .filter(contract -> covers(contract, onDate))
                .max(Comparator.comparing(ContractResponse::startDate))
                .map(contract -> snapshot(contract, tenantId));
    }

    private static boolean covers(ContractResponse contract, LocalDate onDate) {
        return StringUtils.hasText(contract.roomId())
                && contract.startDate() != null && !contract.startDate().isAfter(onDate)
                && (contract.endDate() == null || !contract.endDate().isBefore(onDate));
    }

    private ActiveTenancySnapshot snapshot(ContractResponse contract, String tenantId) {
        RoomResponse room = rooms.getById(contract.roomId());
        String branchName = branches.getById(room.branchId()).name();
        String roomSlotId = StringUtils.hasText(contract.roomSlotId()) ? contract.roomSlotId() : null;
        String slotCode = roomSlotId == null ? null : slotCode(room.id(), roomSlotId);
        boolean representative = tenantId != null && tenantId.equals(contract.tenantId());
        return new ActiveTenancySnapshot(tenantId, contract.id(), null, representative, room.branchId(), branchName,
                room.id(), room.roomNumber(), roomSlotId, slotCode, contract.startDate(), contract.endDate());
    }

    /** RoomSlotService.getById is not implemented yet, so look the slot up among the room's slots. */
    private String slotCode(String roomId, String roomSlotId) {
        return roomSlots.search(new RoomSlotFilterRequest(roomId, null, null), PageRequest.of(0, MAX_SLOTS_PER_ROOM))
                .getContent().stream()
                .filter(slot -> roomSlotId.equals(slot.id()))
                .map(RoomSlotResponse::slotCode)
                .findFirst().orElse(null);
    }
}
