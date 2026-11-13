package com.kitolam.rentalroommanagement.modules.meterreading.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;
import com.kitolam.rentalroommanagement.modules.meterreading.dto.response.TenantMeterYearResponse;
import com.kitolam.rentalroommanagement.modules.meterreading.repository.RoomMeterReadingRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.support.RoomOccupancyCalendar;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only electricity history for tenants, limited to the months their own contract covered. */
@Service
@RequiredArgsConstructor
public class TenantMeterReadingService {

    private final RoomMeterReadingRepository repository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final RoomRepository roomRepository;
    private final RoomOccupancyCalendar occupancy;

    public TenantMeterYearResponse year(String contractId, int year, AuthPrincipal principal) {
        Contract contract = contractRepository.findByIdAndIsDeletedFalse(contractId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
        requireOwner(contract, currentTenant(principal));
        String roomNumber = contract.getRoomId() == null ? null : roomRepository.findByIdAndIsDeletedFalse(contract.getRoomId())
                .map(Room::getRoomNumber).orElse(null);

        List<String> periods = new ArrayList<>();
        for (int m = 1; m <= 12; m++) periods.add(YearMonth.of(year, m).toString());
        Map<String, RoomMeterReading> readings = contract.getRoomId() == null ? Map.of()
                : repository.findByRoomIdAndPeriodInAndIsDeletedFalse(contract.getRoomId(), periods).stream()
                .collect(Collectors.toMap(RoomMeterReading::getPeriod, Function.identity(), (a, b) -> a));

        List<TenantMeterYearResponse.Month> months = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth month = YearMonth.of(year, m);
            RoomMeterReading r = readings.get(month.toString());
            if (r == null || !occupancy.covers(contract, month)) {
                months.add(new TenantMeterYearResponse.Month(m, month.toString(), false, null, null, null, null, null, null));
            } else {
                months.add(new TenantMeterYearResponse.Month(m, month.toString(), true, r.getUnitPrice(),
                        r.getStartReading(), r.getEndReading(), r.getUsage(), r.getAmount(), r.getStatus()));
            }
        }
        return new TenantMeterYearResponse(contract.getId(), contract.getRoomId(), roomNumber, year, months);
    }

    private void requireOwner(Contract contract, Tenant tenant) {
        boolean representative = Objects.equals(contract.getTenantId(), tenant.getId());
        boolean member = contractTenantRepository.findByTenantIdAndIsDeletedFalse(tenant.getId()).stream()
                .map(ContractTenant::getContractId).anyMatch(contract.getId()::equals);
        if (!representative && !member) throw new ForbiddenException("Hợp đồng không thuộc về bạn");
    }

    private Tenant currentTenant(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
    }
}
