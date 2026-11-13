package com.kitolam.rentalroommanagement.modules.contract.service.impl;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractEvidenceHistoryEntry;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.support.ContractExpirySupport;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.support.RoomSlotOccupancySupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;

/**
 * Chuyển hợp đồng đang hiệu lực đã quá endDate sang EXPIRED. Hợp đồng đã được gia hạn
 * ({@code renewedToContractId != null}) chỉ đổi trạng thái — lượt ở đã được kéo dài cho hợp đồng nối tiếp.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContractExpiryJob {

    private final ContractRepository contractRepository;
    private final RoomSlotOccupancySupport occupancySupport;
    private final Clock clock;

    @Scheduled(cron = "${contract.expiry.cron:0 * * * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void expireContracts() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ContractExpirySupport.VIETNAM_ZONE);
        int expired = expireBefore(today);
        if (expired > 0) log.info("Expired {} contracts past endDate", expired);
    }

    /** Public để chạy tay/kiểm thử. Trả về số hợp đồng đã chuyển EXPIRED. */
    public int expireBefore(LocalDate today) {
        int count = 0;
        for (Contract contract : contractRepository.findByStatusAndEndDateBeforeAndIsDeletedFalse(ContractStatus.ACTIVE, today)) {
            contract.setStatus(ContractStatus.EXPIRED);
            if (contract.getEvidenceHistory() == null) contract.setEvidenceHistory(new ArrayList<>());
            contract.getEvidenceHistory().add(new ContractEvidenceHistoryEntry(
                    "CONTRACT_EXPIRED", clock.instant(), "Hệ thống tự động chuyển hợp đồng sang Hết hạn."));
            if (contract.getRenewedToContractId() == null) {
                occupancySupport.endForContract(contract);
                occupancySupport.markTenantsLeft(contract);
            }
            contractRepository.save(contract);
            count++;
        }
        return count;
    }
}
