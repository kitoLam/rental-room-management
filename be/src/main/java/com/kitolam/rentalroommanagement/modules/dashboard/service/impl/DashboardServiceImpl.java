package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.service.AppointmentService;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.booking.service.BookingService.OverviewBooking;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService.OverviewContract;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementOverviewResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementOverviewResponse.*;
import com.kitolam.rentalroommanagement.modules.dashboard.service.DashboardService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import com.kitolam.rentalroommanagement.modules.reportrecord.service.ReportRecordService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.service.SlotServiceRequestService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService.OverviewTenant;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/** Coordinates read-only public projections; it never writes to another module or reads its repository. */
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int PREVIEW_SIZE = 5;
    private static final int ACTIVITY_PAGE_SIZE = 3;
    private final BranchService branches;
    private final RoomService rooms;
    private final RoomSlotService slots;
    private final RoomSlotOccupancyService occupancies;
    private final ContractService contracts;
    private final ContractTenantService tenancies;
    private final BookingService bookings;
    private final AppointmentService appointments;
    private final SlotServiceRequestService serviceRequests;
    private final ReportRequestService reports;
    private final ReportRecordService reportRecords;
    private final TenantService tenants;
    private final ManagerService managers;
    private final InvoiceService invoices;
    private final PaymentService payments;
    private final Clock clock;

    @Override
    public ManagementOverviewResponse management(AuthPrincipal principal, String branchId, YearMonth month, int expiringPage) {
        return management(principal, branchId, month, expiringPage, 0);
    }

    @Override
    public ManagementOverviewResponse management(AuthPrincipal principal, String branchId, YearMonth month, int expiringPage, int activityPage) {
        if (principal == null || !principal.enabled() || !Set.of("OWNER", "MANAGER").contains(principal.role()))
            throw new ForbiddenException("Chỉ Owner/Manager được xem tổng quan quản lý");
        if (expiringPage < 0 || expiringPage > 10000) throw new BadRequestException("Trang hợp đồng không hợp lệ");
        if (activityPage < 0 || activityPage > 10000) throw new BadRequestException("Trang hoạt động không hợp lệ");
        var allowed = branches.managedBranches(principal);
        if (branchId != null && allowed.stream().noneMatch(b -> b.id().equals(branchId)))
            throw new ForbiddenException("Bạn không có quyền xem chi nhánh này");
        var selected = allowed.stream().filter(b -> branchId == null || b.id().equals(branchId)).toList();
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, ZONE);
        var period = month == null ? YearMonth.from(today) : month;
        if (period.getYear() < 1900 || period.getYear() > 9999) throw new BadRequestException("Năm không hợp lệ");
        var roomList = new ArrayList<RoomResponse>();
        for (var branch : selected) {
            for (int page = 0; ; page++) {
                var data = rooms.listByBranch(branch.id(), PageRequest.of(page, 100, Sort.by("_id")));
                roomList.addAll(data.getContent());
                if (page + 1 >= data.getTotalPages()) break;
            }
        }
        var roomById = roomList.stream().collect(Collectors.toMap(RoomResponse::id, Function.identity()));
        var branchById = selected.stream().collect(Collectors.toMap(BranchResponse::id, Function.identity()));
        var roomIds = new ArrayList<>(roomById.keySet());
        var slotList = slots.readForOverview(roomIds);
        var slotById = slotList.stream().collect(Collectors.toMap(RoomSlotService.OverviewSlot::id, Function.identity()));
        var occupancyList = occupancies.readForOverview(new ArrayList<>(slotById.keySet()));
        var contractList = contracts.readForOverview(roomIds);
        var contractById = contractList.stream().collect(Collectors.toMap(OverviewContract::id, Function.identity()));
        var tenancyList = tenancies.readForOverview(new ArrayList<>(contractById.keySet()));
        var bookingList = bookings.readForOverview(new ArrayList<>(slotById.keySet()));
        boolean viewingAllowed = "OWNER".equals(principal.role()) || managers.findAssignment(principal.email())
                .map(m -> m.permissions() != null && m.permissions().contains(ManagerService.VIEWING_PERMISSION)).orElse(false);
        var appointmentList = viewingAllowed ? appointments.readForOverview(roomIds) : List.<AppointmentService.OverviewAppointment>of();
        var serviceList = serviceRequests.readForOverview(roomIds);
        var reportList = reports.readForOverview(roomIds);
        var activityItems = new ArrayList<ActivityItem>();
        var dayStart = today.atStartOfDay(ZONE).toInstant();
        var dayEnd = today.plusDays(1).atStartOfDay(ZONE).toInstant();
        var appointmentById = appointmentList.stream().collect(Collectors.toMap(AppointmentService.OverviewAppointment::id, Function.identity()));
        var bookingById = bookingList.stream().collect(Collectors.toMap(OverviewBooking::id, Function.identity()));
        var serviceById = serviceList.stream().filter(s -> s.id() != null).collect(Collectors.toMap(s -> s.id(), Function.identity()));
        var reportById = reportList.stream().filter(r -> r.id() != null).collect(Collectors.toMap(r -> r.id(), Function.identity()));

        var tenantIds = new HashSet<String>();
        contractList.forEach(c -> { if (c.tenantId() != null) tenantIds.add(c.tenantId()); });
        bookingList.forEach(b -> { if (b.tenantId() != null) tenantIds.add(b.tenantId()); });
        tenancyList.forEach(t -> { if (t.tenantId() != null) tenantIds.add(t.tenantId()); });
        var tenantById = tenants.readForOverview(new ArrayList<>(tenantIds)).stream()
                .collect(Collectors.toMap(OverviewTenant::id, Function.identity()));
        var managerList = managers.readForOverview(selected.stream().map(BranchResponse::id).toList());

        appendActivities(activityItems, "appointment", appointments.readActivitiesForOverview(new ArrayList<>(appointmentById.keySet()), dayStart, dayEnd),
                id -> appointmentById.containsKey(id) ? roomById.get(appointmentById.get(id).roomId()) : null,
                id -> appointmentById.get(id).contactName(), id -> "/manager/appointments/" + id, branchById, dayStart, dayEnd);
        appendActivities(activityItems, "booking", bookings.readActivitiesForOverview(new ArrayList<>(bookingById.keySet()), dayStart, dayEnd),
                id -> bookingById.containsKey(id) ? bookingRoom(bookingById.get(id), slotById, roomById) : null,
                id -> {
                    var booking = bookingById.get(id);
                    var contact = tenantById.get(booking.tenantId());
                    String codes = slotIds(booking).stream().map(slotById::get).filter(Objects::nonNull)
                            .map(s -> Objects.toString(s.slotCode(), "")).collect(Collectors.joining(", "));
                    return (contact == null ? "Yêu cầu giữ chỗ" : contact.fullName()) + (codes.isBlank() ? "" : " · " + codes);
                }, id -> "/manager/bookings/" + id, branchById, dayStart, dayEnd);
        appendActivities(activityItems, "contract", contracts.readActivitiesForOverview(new ArrayList<>(contractById.keySet()), dayStart, dayEnd),
                id -> contractById.containsKey(id) ? roomById.get(contractById.get(id).roomId()) : null,
                id -> contractById.get(id).contractNumber(), id -> "/manager/contracts/" + id, branchById, dayStart, dayEnd);
        appendActivities(activityItems, "service", serviceRequests.readActivitiesForOverview(new ArrayList<>(serviceById.keySet()), dayStart, dayEnd),
                id -> serviceById.containsKey(id) ? roomById.get(serviceById.get(id).roomId()) : null,
                id -> java.util.stream.Stream.of(serviceById.get(id).tenantName(), serviceById.get(id).serviceName(), serviceById.get(id).slotCode())
                        .filter(Objects::nonNull).collect(Collectors.joining(" · ")),
                id -> "/manager/service-requests", branchById, dayStart, dayEnd);
        appendActivities(activityItems, "support", reportRecords.readActivitiesForOverview(new ArrayList<>(reportById.keySet()), dayStart, dayEnd),
                id -> reportById.containsKey(id) ? roomById.get(reportById.get(id).roomId()) : null,
                id -> reportById.get(id).title(), id -> "/manager/maintenance/" + id, branchById, dayStart, dayEnd);
        activityItems.sort(Comparator.comparing(ActivityItem::at).reversed().thenComparing(ActivityItem::id));
        var activityPageItems = activityItems.stream().skip((long) activityPage * ACTIVITY_PAGE_SIZE).limit(ACTIVITY_PAGE_SIZE).toList();

        var tenancyBranch = new HashMap<String, String>();
        var activeTenantByBranch = new HashMap<String, Set<String>>();
        for (var tenancy : tenancyList) {
            var contract = contractById.get(tenancy.contractId());
            if (contract == null || !roomById.containsKey(contract.roomId())) continue;
            String id = roomById.get(contract.roomId()).branchId();
            tenancyBranch.put(tenancy.id(), id);
            if (contract.status() == ContractStatus.ACTIVE && tenancy.status() == ContractTenantStatus.ACTIVE
                    && covers(contract.startDate(), contract.endDate(), today) && covers(tenancy.joinedAt(), tenancy.leftAt(), today)
                    && tenancy.tenantId() != null)
                activeTenantByBranch.computeIfAbsent(id, ignored -> new HashSet<>()).add(tenancy.tenantId());
        }
        var invoiceList = invoices.readForOverview(new ArrayList<>(tenancyBranch.keySet()));
        var invoiceBranch = new HashMap<String, String>();
        invoiceList.forEach(i -> invoiceBranch.put(i.id(), tenancyBranch.get(i.contractTenantId())));
        var receiptByBranch = new HashMap<String, BigDecimal>();
        var paymentList = payments.readForOverview(new ArrayList<>(invoiceBranch.keySet()),
                period.atDay(1).atStartOfDay(ZONE).toInstant(), period.plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant());
        for (var payment : paymentList) {
            String id = invoiceBranch.get(payment.invoiceId());
            if (id != null && payment.amount() != null) receiptByBranch.merge(id, payment.amount(), BigDecimal::add);
        }

        var occupied = new HashSet<String>();
        var held = new HashSet<String>();
        var heldBookingIds = bookingList.stream().filter(b -> heldBooking(b, now))
                .map(OverviewBooking::id).collect(Collectors.toSet());
        var activeOccupancySlots = occupancyList.stream().filter(o -> o.status() == OccupancyStatus.ACTIVE)
                .map(RoomSlotOccupancyService.OverviewOccupancy::roomSlotId).collect(Collectors.toSet());
        for (var occupancy : occupancyList) {
            if (occupancy.status() == OccupancyStatus.ACTIVE) {
                if (covers(occupancy.startDate(), occupancy.endDate(), today)) occupied.add(occupancy.roomSlotId());
                else if (occupancy.startDate() != null && occupancy.startDate().isAfter(today)) held.add(occupancy.roomSlotId());
            }
            if (occupancy.status() == OccupancyStatus.RESERVED && covers(occupancy.startDate(), occupancy.endDate(), today)
                    && heldBookingIds.contains(occupancy.bookingId()))
                held.add(occupancy.roomSlotId());
        }
        bookingList.stream().filter(b -> heldBooking(b, now)).forEach(b -> held.addAll(slotIds(b)));
        var stock = new HashMap<String, long[]>();
        for (var slot : slotList) {
            var room = roomById.get(slot.roomId());
            if (room == null) continue;
            var counts = stock.computeIfAbsent(room.branchId(), ignored -> new long[6]);
            counts[0]++;
            if (room.status() == RoomStatus.INACTIVE || slot.status() == RoomSlotStatus.INACTIVE) counts[5]++;
            else if (room.status() == RoomStatus.MAINTENANCE || slot.status() == RoomSlotStatus.MAINTENANCE) counts[4]++;
            else if (occupied.contains(slot.id()) || (slot.status() == RoomSlotStatus.OCCUPIED && !activeOccupancySlots.contains(slot.id()))) counts[1]++;
            else if (held.contains(slot.id())) counts[2]++;
            else counts[3]++;
        }

        var workByBranch = new HashMap<String, long[]>();
        selected.forEach(b -> workByBranch.put(b.id(), new long[5]));
        appointmentList.stream().filter(a -> a.status() == AppointmentStatus.PENDING)
                .forEach(a -> increment(workByBranch, roomById.get(a.roomId()), 0));
        var linkedBookings = contractList.stream().map(OverviewContract::bookingId).filter(Objects::nonNull).collect(Collectors.toSet());
        for (var booking : bookingList) {
            var room = bookingRoom(booking, slotById, roomById);
            if (booking.status() == BookingStatus.REQUESTED) increment(workByBranch, room, 1);
            if (booking.status() == BookingStatus.CONFIRMED && booking.contractId() == null
                    && !linkedBookings.contains(booking.id()) && heldBooking(booking, now)) increment(workByBranch, room, 2);
        }
        contractList.stream().filter(c -> c.status() == ContractStatus.DRAFT && c.evidenceSubmittedAt() != null)
                .forEach(c -> increment(workByBranch, roomById.get(c.roomId()), 2));
        // Optional-service requests still waiting for a manager decision.
        serviceList.stream().filter(s -> s.status() == SlotServiceRequestStatus.PENDING)
                .forEach(s -> increment(workByBranch, roomById.get(s.roomId()), 3));
        reportList.stream().filter(r -> r.status() == ReportRequestStatus.PENDING || r.status() == ReportRequestStatus.IN_PROGRESS)
                .forEach(r -> increment(workByBranch, roomById.get(r.roomId()), 4));
        long[] work = new long[5];
        workByBranch.values().forEach(counts -> { for (int i = 0; i < work.length; i++) work[i] += counts[i]; });
        var pending = new ArrayList<WorkItem>();
        if (viewingAllowed) pending.add(new WorkItem("appointments", "Lịch xem chờ duyệt", work[0], "/manager/appointments", "PENDING"));
        pending.add(new WorkItem("bookings", "Giữ chỗ chờ duyệt", work[1], "/manager/bookings", "REQUESTED"));
        pending.add(new WorkItem("contracts", "Hợp đồng cần lập / duyệt minh chứng", work[2], "/manager/contracts", null));
        pending.add(new WorkItem("services", "Dịch vụ chờ duyệt / xác nhận", work[3], "/manager/service-requests", null));
        pending.add(new WorkItem("support", "Hỗ trợ chờ tiếp nhận / đang xử lý", work[4], "/manager/maintenance", null));

        var todayAppointments = appointmentList.stream().filter(a -> a.status() == AppointmentStatus.CONFIRMED
                        && a.approvedAt() != null && today.equals(LocalDate.ofInstant(a.approvedAt(), ZONE)))
                .sorted(Comparator.comparing(AppointmentService.OverviewAppointment::approvedAt).reversed()
                        .thenComparing(AppointmentService.OverviewAppointment::id))
                .limit(PREVIEW_SIZE).map(a -> {
                    var room = roomById.get(a.roomId()); var branch = branchById.get(room.branchId());
                    return new AppointmentItem(a.id(), branch.id(), branch.name(), room.roomNumber(), a.startAt(),
                            a.endAt(), a.shiftType(), a.contactName(), a.contactPhone(), a.approvedAt(), a.approvedBy(), a.approvedByName());
                }).toList();
        var moveIns = bookingList.stream().filter(b -> b.status() == BookingStatus.CONFIRMED && heldBooking(b, now)
                        && b.expectedMoveInDate() != null && !b.expectedMoveInDate().isBefore(today)
                        && !b.expectedMoveInDate().isAfter(today.plusDays(7)))
                .sorted(Comparator.comparing(OverviewBooking::expectedMoveInDate).thenComparing(OverviewBooking::id)).limit(PREVIEW_SIZE)
                .filter(b -> bookingRoom(b, slotById, roomById) != null).map(b -> {
                    var room = bookingRoom(b, slotById, roomById); var branch = branchById.get(room.branchId());
                    var tenant = tenantById.get(b.tenantId());
                    String codes = slotIds(b).stream().map(slotById::get).filter(Objects::nonNull)
                            .map(s -> Objects.toString(s.slotCode(), "")).collect(Collectors.joining(", "));
                    return new MoveInItem(b.id(), branch.id(), branch.name(), room.roomNumber(), codes,
                            b.expectedMoveInDate(), tenant == null ? null : tenant.fullName(), tenant == null ? null : tenant.phone());
                }).toList();
        var expiring = contractList.stream().filter(c -> c.status() == ContractStatus.ACTIVE && expiring(c.endDate(), today))
                .sorted(Comparator.comparing(OverviewContract::endDate).thenComparing(OverviewContract::id)).toList();
        var expiryItems = expiring.stream().skip((long) expiringPage * PREVIEW_SIZE).limit(PREVIEW_SIZE).map(c -> {
            var room = roomById.get(c.roomId()); var branch = branchById.get(room.branchId());
            var contact = tenantById.get(c.tenantId());
            if (contact == null) contact = tenancyList.stream().filter(t -> c.id().equals(t.contractId()) && t.status() == ContractTenantStatus.ACTIVE)
                    .map(t -> tenantById.get(t.tenantId())).filter(Objects::nonNull).findFirst().orElse(null);
            return new ExpiringContract(c.id(), c.contractNumber(), branch.id(), branch.name(), room.roomNumber(),
                    contact == null ? null : contact.fullName(), contact == null ? null : contact.phone(), c.endDate(), ChronoUnit.DAYS.between(today, c.endDate()));
        }).toList();
        var rows = selected.stream().map(b -> {
            long[] counts = stock.getOrDefault(b.id(), new long[6]);
            String managerNames = managerList.stream().filter(m -> b.id().equals(m.branchId())).map(ManagerService.OverviewManager::fullName)
                    .filter(Objects::nonNull).distinct().sorted().collect(Collectors.joining(", "));
            return new BranchRow(b.id(), b.name(), managerNames.isBlank() ? null : managerNames,
                    roomList.stream().filter(r -> b.id().equals(r.branchId())).count(), counts[0] - counts[4] - counts[5], counts[1], counts[3],
                    activeTenantByBranch.getOrDefault(b.id(), Set.of()).size(), receiptByBranch.getOrDefault(b.id(), BigDecimal.ZERO),
                    Arrays.stream(workByBranch.get(b.id())).sum());
        }).toList();
        long[] all = new long[6];
        stock.values().forEach(counts -> { for (int i = 0; i < all.length; i++) all[i] += counts[i]; });
        var uniqueTenants = activeTenantByBranch.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        return new ManagementOverviewResponse(period.toString(), today, now,
                allowed.stream().map(b -> new BranchOption(b.id(), b.name())).toList(),
                new Metrics(all[1], all[3], uniqueTenants.size(), receiptByBranch.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)),
                new SlotSummary(all[0], all[0] - all[4] - all[5], all[1], all[2], all[3], all[4], all[5]),
                pending, todayAppointments, moveIns, PagedResponse.of(expiryItems, expiringPage + 1, PREVIEW_SIZE, expiring.size()), rows,
                PagedResponse.of(activityPageItems, activityPage + 1, ACTIVITY_PAGE_SIZE, activityItems.size()));
    }

    private static void appendActivities(List<ActivityItem> target, String kind, List<ActivitySnapshot> events,
                                         Function<String, RoomResponse> roomFor, Function<String, String> subjectFor,
                                         Function<String, String> routeFor, Map<String, BranchResponse> branches,
                                         Instant from, Instant to) {
        for (var event : events) {
            String label = activityLabel(kind, event.action());
            if (label == null || !event.within(from, to)) continue;
            var room = roomFor.apply(event.subjectId());
            if (room == null || !branches.containsKey(room.branchId())) continue;
            var branch = branches.get(room.branchId());
            target.add(new ActivityItem(kind + ":" + event.id(), kind, event.action(), label, event.at(),
                    branch.id(), branch.name(), room.roomNumber(), subjectFor.apply(event.subjectId()),
                    event.actorAccountId(), event.actorName(), event.note(), routeFor.apply(event.subjectId())));
        }
    }

    private static String activityLabel(String kind, String action) {
        return switch (kind + ":" + action) {
            case "appointment:APPROVED" -> "Đã duyệt lịch xem phòng";
            case "appointment:REJECTED" -> "Đã từ chối lịch xem phòng";
            case "appointment:CANCELLED", "appointment:SYSTEM_CANCELLED", "appointment:TENANT_CANCELLED" -> "Đã hủy lịch xem phòng";
            case "appointment:EXPIRED" -> "Lịch xem phòng đã hết hạn";
            case "appointment:COMPLETED" -> "Đã ghi nhận xem phòng hoàn tất";
            case "appointment:NO_SHOW" -> "Đã ghi nhận khách không đến xem";
            case "appointment:RESULT_CORRECTED" -> "Đã điều chỉnh kết quả xem phòng";
            case "booking:APPROVED" -> "Đã duyệt giữ chỗ và gửi điều khoản";
            case "booking:AWAITING_PAYMENT" -> "Giữ chỗ đã chuyển sang chờ thanh toán";
            case "booking:UPDATED" -> "Đã cập nhật yêu cầu giữ chỗ";
            case "booking:CONFIRMED" -> "Đã xác nhận giữ chỗ";
            case "booking:REJECTED" -> "Đã từ chối yêu cầu giữ chỗ";
            case "booking:CANCELLED" -> "Đã hủy yêu cầu giữ chỗ";
            case "booking:EXPIRED" -> "Yêu cầu giữ chỗ đã hết hạn";
            case "booking:CONVERTED" -> "Đã chuyển giữ chỗ sang hợp đồng";
            case "contract:CREATED" -> "Đã lập hợp đồng";
            case "contract:APPROVED" -> "Đã duyệt minh chứng hợp đồng";
            case "contract:RESUBMISSION_REQUESTED" -> "Đã yêu cầu bổ sung minh chứng hợp đồng";
            case "contract:EXPIRED", "contract:TERMINATED" -> "Đã kết thúc / hủy hợp đồng";
            case "service:APPROVED" -> "Đã duyệt yêu cầu dịch vụ";
            case "service:REJECTED" -> "Đã từ chối yêu cầu dịch vụ";
            case "service:CANCELLED" -> "Đã hủy yêu cầu dịch vụ";
            case "service:COMPLETED" -> "Đã xác nhận thực hiện dịch vụ";
            case "support:ASSIGNED" -> "Đã phân công xử lý hỗ trợ";
            case "support:REQUESTED_INFO" -> "Đã yêu cầu bổ sung thông tin hỗ trợ";
            case "support:PROGRESS_UPDATED", "support:STATUS_CHANGED", "support:REOPENED" -> "Đã cập nhật xử lý hỗ trợ";
            case "support:RESOLVED", "support:CLOSED" -> "Đã giải quyết / đóng yêu cầu hỗ trợ";
            case "support:REJECTED" -> "Đã từ chối yêu cầu hỗ trợ";
            case "support:CANCELLED" -> "Đã hủy yêu cầu hỗ trợ";
            default -> null;
        };
    }

    static boolean expiring(LocalDate end, LocalDate today) {
        return end != null && !end.isBefore(today) && !today.isBefore(end.minusMonths(1));
    }
    private static boolean covers(LocalDate start, LocalDate end, LocalDate date) {
        return (start == null || !start.isAfter(date)) && (end == null || !end.isBefore(date));
    }
    private static List<String> slotIds(OverviewBooking booking) {
        if (booking.roomSlotIds() != null && !booking.roomSlotIds().isEmpty()) return booking.roomSlotIds();
        return booking.roomSlotId() == null ? List.of() : List.of(booking.roomSlotId());
    }
    private static boolean heldBooking(OverviewBooking booking, Instant now) {
        if (booking.status() == BookingStatus.CONFIRMED)
            return booking.checkInDeadline() == null || booking.checkInDeadline().isAfter(now);
        return booking.status() == BookingStatus.AWAITING_PAYMENT && booking.holdExpiresAt() != null
                && booking.holdExpiresAt().isAfter(now) && booking.paymentDeadline() != null && booking.paymentDeadline().isAfter(now);
    }
    private static RoomResponse bookingRoom(OverviewBooking booking, Map<String, RoomSlotService.OverviewSlot> slots,
                                            Map<String, RoomResponse> rooms) {
        return slotIds(booking).stream().map(slots::get).filter(Objects::nonNull).map(s -> rooms.get(s.roomId()))
                .filter(Objects::nonNull).findFirst().orElse(null);
    }
    private static void increment(Map<String, long[]> work, RoomResponse room, int index) {
        if (room != null && work.containsKey(room.branchId())) work.get(room.branchId())[index]++;
    }
}
