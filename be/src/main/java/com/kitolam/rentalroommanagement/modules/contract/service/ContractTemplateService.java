package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.support.SlotPricing;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContractTemplateService {

    private final ContractRepository contracts;
    private final BranchRepository branches;
    private final UserRepository users;
    private final RoomServiceRepository roomServices;
    private final Clock clock;

    public void createForSlot(Room room, RoomSlot slot) {
        Contract contract = prepare(room, slot);
        contract.setStatus(ContractStatus.TEMPLATE);
        queuePdf(contract);
        contracts.save(contract);
    }

    public void removeForSlot(String slotId) {
        contracts.findFirstByRoomSlotIdAndStatusAndIsDeletedFalse(slotId, ContractStatus.TEMPLATE)
                .ifPresent(contract -> {
                    contract.markDeleted();
                    contracts.save(contract);
                });
    }

    public Contract prepare(Room room, RoomSlot slot) {
        Contract contract = contracts.findFirstByRoomSlotIdAndStatusAndIsDeletedFalse(slot.getId(), ContractStatus.TEMPLATE)
                .orElseGet(Contract::new);
        Branch branch = branches.findByIdAndIsDeletedFalse(room.getBranchId()).orElse(null);
        User owner = branch == null || branch.getOwnerAccountId() == null ? null
                : users.findByIdAndIsDeletedFalse(branch.getOwnerAccountId()).orElse(null);
        mapParty(contract, owner, null, true);

        contract.setRoomId(room.getId());
        contract.setRoomSlotId(slot.getId());
        contract.setRoomSlotIds(List.of(slot.getId()));
        contract.setRoomAddress((branch == null || branch.getAddress() == null ? "" : branch.getAddress() + " · ")
                + room.getRoomNumber() + " · Chỗ " + slot.getSlotCode());
        BigDecimal rent = SlotPricing.rent(room);
        contract.setRentPrice(rent == null ? BigDecimal.ZERO : rent);
        contract.setContractDepositAmount(SlotPricing.deposit(room));
        contract.setMaxOccupants(1);
        contract.setElectricityRate(branch == null ? null : branch.getElectricityRate());
        var services = new ArrayList<ContractServiceSnapshot>();
        if (room.getRoomServiceIds() != null && !room.getRoomServiceIds().isEmpty()) {
            roomServices.findByIdInAndIsDeletedFalse(room.getRoomServiceIds()).stream()
                    .filter(service -> service.getStatus() == RoomServiceStatus.ACTIVE
                            && room.getBranchId().equals(service.getBranchId()))
                    .map(ContractTemplateService::snapshot)
                    .forEach(services::add);
        }
        contract.setServices(services);
        contract.setWaterRate(services.stream().filter(ContractTemplateService::isWaterService)
                .map(ContractServiceSnapshot::getUnitPrice).filter(Objects::nonNull).findFirst().orElse(null));
        return contract;
    }

    public void fillTenant(Contract contract, Tenant tenant) {
        User user = tenant == null || tenant.getEmail() == null ? null
                : users.findByEmailAndIsDeletedFalse(tenant.getEmail()).orElse(null);
        mapParty(contract, user, tenant, false);
    }

    public void queuePdf(Contract contract) {
        contract.setPdfRevision(UUID.randomUUID().toString());
        contract.setPdfNextAttemptAt(contract.getStatus() == ContractStatus.TEMPLATE || contract.getTermMonths() != null
                ? clock.instant() : null);
        contract.setPdfProcessing(false);
        contract.setContractUrl(null);
    }

    static boolean isWaterService(ContractServiceSnapshot service) {
        if (!service.isMandatory() || service.getName() == null) return false;
        String name = Normalizer.normalize(service.getName().strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return name.equals("nuoc") || name.startsWith("nuoc ") || name.startsWith("tien nuoc");
    }

    private static ContractServiceSnapshot snapshot(RoomService service) {
        ContractServiceSnapshot snapshot = new ContractServiceSnapshot();
        snapshot.setServiceId(service.getId());
        snapshot.setName(service.getName());
        snapshot.setUnitPrice(service.getUnitPrice());
        snapshot.setMandatory(true);
        snapshot.setSelected(true);
        return snapshot;
    }

    private static void mapParty(Contract contract, User user, Tenant tenant, boolean landlord) {
        String name = user != null ? user.getFullName() : tenant == null ? null : tenant.getFullName();
        String idNumber = user != null ? user.getCccdNumber() : tenant == null ? null : tenant.getIdCardNumber();
        String address = user != null ? user.getPermanentAddress() : tenant == null ? null : tenant.getAddress();
        String birth = user != null ? user.getDateOfBirth()
                : tenant == null || tenant.getDateOfBirth() == null ? null : tenant.getDateOfBirth().toString();
        String phone = user != null ? user.getPhone() : tenant == null ? null : tenant.getPhone();
        String issueDate = user == null ? null : user.getCccdIssueDate();
        String issuePlace = user == null ? null : user.getCccdIssuePlace();
        if (landlord) {
            contract.setLandlordName(name);
            contract.setLandlordIdNumber(idNumber);
            contract.setLandlordAddress(address);
            contract.setLandlordDateOfBirth(birth);
            contract.setLandlordPhone(phone);
            contract.setLandlordIdIssueDate(issueDate);
            contract.setLandlordIdIssuePlace(issuePlace);
        } else {
            contract.setTenantName(name);
            contract.setTenantIdNumber(idNumber);
            contract.setTenantAddress(address);
            contract.setTenantDateOfBirth(birth);
            contract.setTenantPhone(phone);
            contract.setTenantIdIssueDate(issueDate);
            contract.setTenantIdIssuePlace(issuePlace);
        }
    }
}
