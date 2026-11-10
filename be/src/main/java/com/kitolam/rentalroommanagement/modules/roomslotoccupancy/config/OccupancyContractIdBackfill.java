package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.config;

import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-off data fix: occupancies created before contractId existed only point to a contract tenant.
 * Fills contractId from that contract tenant so billing can find them. Safe to run on every start
 * (only touches documents still missing the field).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OccupancyContractIdBackfill implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;
    private final RoomSlotOccupancyRepository occupancyRepository;
    private final ContractTenantRepository contractTenantRepository;

    @Override
    public void run(ApplicationArguments args) {
        Query missing = new Query(Criteria.where("contractId").exists(false).and("contractTenantId").ne(null));
        List<RoomSlotOccupancy> occupancies = mongoTemplate.find(missing, RoomSlotOccupancy.class);
        int fixed = 0;
        for (RoomSlotOccupancy occupancy : occupancies) {
            String contractId = contractTenantRepository.findById(occupancy.getContractTenantId())
                    .map(ContractTenant::getContractId)
                    .orElse(null);
            if (contractId != null) {
                occupancy.setContractId(contractId);
                occupancyRepository.save(occupancy);
                fixed++;
            }
        }
        if (fixed > 0) {
            log.info("Backfilled contractId on {} room slot occupancies", fixed);
        }
    }
}
