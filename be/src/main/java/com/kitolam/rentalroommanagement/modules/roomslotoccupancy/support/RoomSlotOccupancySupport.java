package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.support;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

/**
 * Gom thao tác occupancy/ContractTenant theo một hợp đồng — tránh sửa nhầm lượt ở của người thuê kế tiếp
 * cùng slot (kiến trúc "one contract per slot": một slot có thể có nhiều hợp đồng nối tiếp theo thời gian).
 */
@Component
@RequiredArgsConstructor
public class RoomSlotOccupancySupport {

    private final RoomSlotOccupancyRepository occupancyRepository;
    private final ContractTenantRepository contractTenantRepository;

    /**
     * Kết thúc lượt ở của đúng hợp đồng này: occupancy ACTIVE thuộc slot của hợp đồng và trùng
     * ở-contract (theo ContractTenant) hoặc trùng endDate — KHÔNG đụng lượt ở của hợp đồng kế tiếp.
     */
    public void endForContract(Contract contract) {
        List<RoomSlotOccupancy> active = occupancyRepository.findByRoomSlotIdAndStatusInAndIsDeletedFalse(
                contract.getRoomSlotId(), List.of(OccupancyStatus.ACTIVE));
        List<String> contractTenantIds = contractTenantRepository.findByContractIdAndIsDeletedFalse(contract.getId())
                .stream().map(ContractTenant::getId).toList();
        for (RoomSlotOccupancy occupancy : active) {
            boolean sameTenancy = occupancy.getContractTenantId() != null
                    && contractTenantIds.contains(occupancy.getContractTenantId());
            boolean sameWindow = occupancy.getEndDate() != null
                    && Objects.equals(occupancy.getEndDate(), contract.getEndDate());
            if (sameTenancy || sameWindow) {
                occupancy.setStatus(OccupancyStatus.ENDED);
                occupancyRepository.save(occupancy);
            }
        }
    }

    /** Đánh dấu các ContractTenant của hợp đồng này đã rời đi. */
    public void markTenantsLeft(Contract contract) {
        for (ContractTenant tenant : contractTenantRepository.findByContractIdAndIsDeletedFalse(contract.getId())) {
            if (tenant.getStatus() != ContractTenantStatus.LEFT) {
                tenant.setStatus(ContractTenantStatus.LEFT);
                contractTenantRepository.save(tenant);
            }
        }
    }

    /** Kéo dài lượt ở hiện tại của slot (của hợp đồng này) tới endDate mới — dùng khi gia hạn. */
    public void extendForContract(Contract contract, java.time.LocalDate newEndDate) {
        List<RoomSlotOccupancy> active = occupancyRepository.findByRoomSlotIdAndStatusInAndIsDeletedFalse(
                contract.getRoomSlotId(), List.of(OccupancyStatus.ACTIVE));
        List<String> contractTenantIds = contractTenantRepository.findByContractIdAndIsDeletedFalse(contract.getId())
                .stream().map(ContractTenant::getId).toList();
        for (RoomSlotOccupancy occupancy : active) {
            boolean sameTenancy = occupancy.getContractTenantId() != null
                    && contractTenantIds.contains(occupancy.getContractTenantId());
            boolean sameWindow = occupancy.getEndDate() != null
                    && Objects.equals(occupancy.getEndDate(), contract.getEndDate());
            if (sameTenancy || sameWindow) {
                occupancy.setEndDate(newEndDate);
                occupancyRepository.save(occupancy);
            }
        }
    }
}
