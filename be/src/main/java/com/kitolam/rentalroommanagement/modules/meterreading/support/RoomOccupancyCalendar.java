package com.kitolam.rentalroommanagement.modules.meterreading.support;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Which rooms had someone living in them during a month: a non-DRAFT contract whose stay
 * [startDate, endDate) — cut at terminatedAt when terminated — overlaps the month.
 */
@Component
@RequiredArgsConstructor
public class RoomOccupancyCalendar {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ContractRepository contractRepository;

    public Set<String> occupiedRooms(Collection<String> roomIds, YearMonth month) {
        if (roomIds.isEmpty()) return Set.of();
        return occupiedRooms(contractRepository.findByRoomIdInAndIsDeletedFalse(roomIds), month);
    }

    /** Same rule over contracts already loaded (the seeder checks many months at once). */
    public Set<String> occupiedRooms(List<Contract> contracts, YearMonth month) {
        return contracts.stream()
                .filter(c -> c.getRoomId() != null && covers(c, month))
                .map(Contract::getRoomId)
                .collect(Collectors.toSet());
    }

    /** Whether the contract's stay overlaps the month (DRAFT contracts never count). */
    public boolean covers(Contract c, YearMonth month) {
        if (c.getStatus() == null || c.getStatus() == ContractStatus.DRAFT
                || c.getStatus() == ContractStatus.TEMPLATE || c.getStartDate() == null) return false;
        if (!c.getStartDate().isBefore(month.plusMonths(1).atDay(1))) return false;
        LocalDate end = stayEnd(c);
        // A stay that ends on / before its own start (e.g. terminated before moving in) never counts.
        return end == null || (end.isAfter(month.atDay(1)) && end.isAfter(c.getStartDate()));
    }

    /** Exclusive end of the stay, or null when open-ended. */
    public LocalDate stayEnd(Contract c) {
        LocalDate end = c.getEndDate();
        if (c.getStatus() == ContractStatus.TERMINATED && c.getTerminatedAt() != null) {
            LocalDate terminated = c.getTerminationSettlement() != null
                    ? c.getTerminationSettlement().lastRentalDate().plusDays(1)
                    : c.getTerminatedAt().atZone(VIETNAM).toLocalDate();
            if (end == null || terminated.isBefore(end)) end = terminated;
        }
        return end;
    }
}
