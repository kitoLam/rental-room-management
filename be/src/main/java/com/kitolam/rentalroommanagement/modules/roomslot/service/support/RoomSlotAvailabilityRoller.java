package com.kitolam.rentalroommanagement.modules.roomslot.service.support;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Ngày bắt đầu thuê ({@code availableFrom}) của slot: mốc "hôm nay" theo giờ Việt Nam và quy tắc dời +7 ngày.
 * Dùng chung cho job dời ngày, migration, lúc đặt cọc và lúc chốt hợp đồng để mọi nơi tính giống nhau.
 */
public final class RoomSlotAvailabilityRoller {

    public static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final long ROLL_DAYS = 7;

    /** Số ngày trước khi hết hạn thuê mà slot được nhả cho khách đặt cọc mới. */
    public static final long RELEASE_LEAD_DAYS = 14;

    private RoomSlotAvailabilityRoller() {
    }

    /** "Hôm nay" theo Asia/Ho_Chi_Minh, không phụ thuộc múi giờ của server. */
    public static LocalDate todayVietnam(Clock clock) {
        return LocalDate.ofInstant(clock.instant(), VIETNAM_ZONE);
    }

    public static LocalDate requireFuture(LocalDate date, LocalDate today) {
        if (date == null || !date.isAfter(today))
            throw new BadRequestException("Ngày bắt đầu cho thuê phải sau ngày hôm nay.");
        return date;
    }

    /**
     * Ngày sớm nhất một slot đang có lượt ở (RESERVED/ACTIVE) được coi là trống để khách mới đặt cọc:
     * {@code endDate - 14 ngày}. Lượt ở không có endDate thì coi như không giới hạn (trả null = slot kín).
     */
    public static LocalDate releaseDate(LocalDate occupancyEndDate) {
        return occupancyEndDate == null ? null : occupancyEndDate.minusDays(RELEASE_LEAD_DAYS);
    }

    /** True nếu lượt ở hiện tại kết thúc đủ sớm để slot được nhả trước {@code requestedStart}. */
    public static boolean releasesBefore(LocalDate occupancyEndDate, LocalDate requestedStart) {
        LocalDate release = releaseDate(occupancyEndDate);
        return release != null && requestedStart != null && !release.isAfter(requestedStart);
    }

    /**
     * Move a past date forward in seven-day steps until it reaches today or later.
     * Ví dụ: 01/12/2026 với hôm nay 02/12/2026 → 08/12/2026.
     */
    public static LocalDate rollForward(LocalDate availableFrom, LocalDate todayVietnam) {
        if (availableFrom == null) return null;
        LocalDate result = availableFrom;
        while (result.isBefore(todayVietnam)) {
            result = result.plusDays(ROLL_DAYS);
        }
        return result;
    }

    public static LocalDate rollOverdueIntoFuture(LocalDate availableFrom, LocalDate today) {
        if (availableFrom == null || !availableFrom.isBefore(today)) return availableFrom;
        return rollForward(availableFrom, today.plusDays(1));
    }
}
