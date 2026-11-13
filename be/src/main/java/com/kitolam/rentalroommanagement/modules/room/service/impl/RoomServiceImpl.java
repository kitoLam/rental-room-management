package com.kitolam.rentalroommanagement.modules.room.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.mapper.RoomMapper;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomUtilityRatesResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Query;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomSlotUsageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private static final List<OccupancyStatus> HOLDING = List.of(OccupancyStatus.RESERVED, OccupancyStatus.ACTIVE);
    /** Booking requests still being processed (CONVERTED ones are covered by their contract). */
    private static final List<BookingStatus> LIVE_BOOKINGS = List.of(BookingStatus.REQUESTED, BookingStatus.PENDING,
            BookingStatus.AWAITING_PAYMENT, BookingStatus.APPROVED, BookingStatus.CONFIRMED);

    private final RoomRepository roomRepository;
    private final RoomMapper mapper;
    private final BranchService branches;
    private final MongoTemplate mongo;
    private final Clock clock;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository occupancyRepository;

    @Override
    public List<StatusTotal> readStatusTotalsForAdmin() {
        return roomRepository.readStatusTotalsForAdmin();
    }

    private Room find(String id) {
        return roomRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
    }

    /** Utility rates always come from the room's branch. */
    @Override
    public UtilityRatesResponse publicUtilityRates(String roomId) {
        return configuration(find(roomId)).effectiveRates();
    }

    @Override
    public RoomUtilityRatesResponse utilityRateConfiguration(String roomId, AuthPrincipal principal) {
        var room = find(roomId);
        branches.requireManagementAccess(room.getBranchId(), principal);
        return configuration(room);
    }

    private RoomUtilityRatesResponse configuration(Room room) {
        var branch = branches.getById(room.getBranchId());
        var rates = mapper.toUtilityRates(branch);
        return new RoomUtilityRatesResponse(room.getId(), branch.id(), room.getRoomNumber(), branch.name(), rates, rates, rates);
    }

    @Override
    public PagedResponse<RoomResponse> listByBranch(String branchId, Pageable pageable) {
        return PagedResponse.from(roomRepository.findWithPagination(Criteria.where("branchId")
                .is(MongoQueryHelper.toObjectId(branchId)), pageable), mapper::toResponse);
    }

    @Override
    @Transactional
    public RoomResponse create(RoomCreateRequest request, AuthPrincipal principal) {
        requireAccess(request.branchId(), principal);
        Room room = new Room();
        room.setBranchId(request.branchId());
        room.setTitle(request.title().trim());
        room.setRoomNumber(request.roomNumber().trim());
        room.setFloor(request.floor());
        room.setArea(request.area());
        room.setMaxOccupants(request.maxOccupants());
        room.setListedRentPrice(request.listedRentPrice());
        room.setListedDepositAmount(request.listedDepositAmount());
        room.setAmenities(request.amenities() == null ? new ArrayList<>() : new ArrayList<>(request.amenities()));
        room.setImages(request.images() == null ? new ArrayList<>() : new ArrayList<>(request.images()));
        room.setRules(request.rules());
        room.setRoomServiceIds(validRoomServices(request.branchId(), request.roomServiceIds()));
        ensureUniqueNumber(room);
        Room saved = roomRepository.save(room);
        syncSlots(saved);
        return mapper.toResponse(saved);
    }

    @Override
    public RoomResponse getById(String id) {
        return mapper.toResponse(find(id));
    }

    @Override
    public PagedResponse<RoomResponse> search(RoomFilterRequest filter, Pageable pageable) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "roomNumber", "title");
        if (filter.minCapacity() != null) criteria.add(Criteria.where("maxOccupants").gte(filter.minCapacity()));
        if (filter.minPrice() != null) criteria.add(Criteria.where("listedRentPrice").gte(filter.minPrice()));
        if (filter.maxPrice() != null) criteria.add(Criteria.where("listedRentPrice").lte(filter.maxPrice()));
        return PagedResponse.from(MongoQueryHelper.page(mongo, criteria, pageable, Room.class), mapper::toResponse);
    }

    @Override
    @Transactional
    public RoomResponse update(String id, RoomUpdateRequest request, AuthPrincipal principal) {
        Room room = find(id);
        requireAccess(room.getBranchId(), principal);
        if (request.title() != null) room.setTitle(request.title().trim());
        if (request.roomNumber() != null) room.setRoomNumber(request.roomNumber().trim());
        if (request.floor() != null) room.setFloor(request.floor());
        if (request.area() != null) room.setArea(request.area());
        if (request.maxOccupants() != null) room.setMaxOccupants(request.maxOccupants());
        if (request.listedRentPrice() != null) room.setListedRentPrice(request.listedRentPrice());
        if (request.listedDepositAmount() != null) room.setListedDepositAmount(request.listedDepositAmount());
        if (request.amenities() != null) room.setAmenities(new ArrayList<>(request.amenities()));
        if (request.images() != null) room.setImages(new ArrayList<>(request.images()));
        if (request.rules() != null) room.setRules(request.rules());
        if (request.roomServiceIds() != null) room.setRoomServiceIds(validRoomServices(room.getBranchId(), request.roomServiceIds()));
        if (request.status() != null && request.status() != room.getStatus()) {
            boolean closing = request.status() == RoomStatus.MAINTENANCE || request.status() == RoomStatus.INACTIVE;
            if (closing) {
                // A room can only leave "active" once nobody lives in / holds any of its slots.
                List<RoomSlot> slots = roomSlotRepository.findByRoomIdAndIsDeletedFalse(room.getId());
                Map<String, String> busy = busySlots(slots);
                if (!busy.isEmpty()) {
                    throw new BadRequestException("Không thể chuyển phòng " + room.getRoomNumber() + " sang "
                            + (request.status() == RoomStatus.MAINTENANCE ? "bảo trì" : "ngừng hoạt động")
                            + " vì còn " + busy.size() + " chỗ đang có người ở hoặc được giữ: " + describe(slots, busy)
                            + ". Phòng chỉ đổi trạng thái được khi không còn ai ở.");
                }
            }
            room.setStatus(request.status());
        }
        ensureUniqueNumber(room);
        syncSlots(room);
        return mapper.toResponse(roomRepository.save(room));
    }

    @Override
    @Transactional
    public void delete(String id, AuthPrincipal principal) {
        Room room = find(id);
        requireAccess(room.getBranchId(), principal);
        List<RoomSlot> slots = roomSlotRepository.findByRoomIdAndIsDeletedFalse(room.getId());
        Map<String, String> busy = busySlots(slots);
        if (!busy.isEmpty()) {
            throw new ConflictException("Không thể xoá phòng " + room.getRoomNumber() + " vì còn " + busy.size()
                    + " chỗ đang được giữ hoặc có người ở: " + describe(slots, busy)
                    + ". Hãy xử lý các yêu cầu giữ chỗ / hợp đồng này trước.");
        }
        slots.forEach(slot -> {
            slot.markDeleted();
            roomSlotRepository.save(slot);
        });
        room.markDeleted();
        roomRepository.save(room);
    }

    @Override
    public List<RoomSlotUsageResponse> slots(String roomId, AuthPrincipal principal) {
        Room room = find(roomId);
        requireAccess(room.getBranchId(), principal);
        List<RoomSlot> slots = sortedSlots(room.getId());
        Map<String, String> busy = busySlots(slots);
        return slots.stream().map(slot -> usage(slot, busy)).toList();
    }

    @Override
    public RoomSlotUsageResponse updateSlotAvailableFrom(String roomId, String slotId, LocalDate availableFrom,
                                                         AuthPrincipal principal) {
        Room room = find(roomId);
        requireAccess(room.getBranchId(), principal);
        RoomSlot slot = roomSlotRepository.findByRoomIdAndIsDeletedFalse(room.getId()).stream()
                .filter(s -> s.getId().equals(slotId)).findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chỗ ở trong phòng " + room.getRoomNumber()));
        String reason = busySlots(List.of(slot)).get(slot.getId());
        if (reason != null) {
            throw new BadRequestException("Không thể đổi ngày bắt đầu cho thuê của chỗ " + slot.getSlotCode()
                    + " vì chỗ này " + reason + ". Chỉ chỉnh được khi chỗ chưa có ai ở hay giữ.");
        }
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));
        if (availableFrom.isBefore(today)) {
            throw new BadRequestException("Ngày bắt đầu cho thuê không được ở quá khứ");
        }
        slot.setAvailableFrom(availableFrom);
        return usage(roomSlotRepository.save(slot), Map.of());
    }

    private List<RoomSlot> sortedSlots(String roomId) {
        List<RoomSlot> slots = new ArrayList<>(roomSlotRepository.findByRoomIdAndIsDeletedFalse(roomId));
        slots.sort(Comparator.comparing(s -> s.getSlotNumber() == null ? 0 : s.getSlotNumber()));
        return slots;
    }

    private static RoomSlotUsageResponse usage(RoomSlot slot, Map<String, String> busy) {
        String reason = busy.get(slot.getId());
        return new RoomSlotUsageResponse(slot.getId(), slot.getSlotCode(), slot.getSlotNumber(), slot.getStatus(),
                slot.getAvailableFrom(), reason != null, reason);
    }

    /**
     * Keeps exactly maxOccupants live slots (S1..Sn). Missing slots are created; extra slots are removed
     * from the highest number down, but only if nobody holds them.
     */
    private void syncSlots(Room room) {
        int target = room.getMaxOccupants() == null ? 1 : room.getMaxOccupants();
        List<RoomSlot> slots = new ArrayList<>(roomSlotRepository.findByRoomIdAndIsDeletedFalse(room.getId()));
        slots.sort(Comparator.comparing(s -> s.getSlotNumber() == null ? 0 : s.getSlotNumber()));
        if (slots.size() > target) {
            int toRemove = slots.size() - target;
            Map<String, String> busy = busySlots(slots);
            // Any free slot can go (highest numbers first); busy ones always stay.
            List<RoomSlot> free = slots.stream().filter(slot -> !busy.containsKey(slot.getId()))
                    .sorted(Comparator.comparing((RoomSlot slot) -> slot.getSlotNumber() == null ? 0 : slot.getSlotNumber()).reversed())
                    .toList();
            if (free.size() < toRemove) {
                throw new BadRequestException("Không thể giảm sức chứa từ " + slots.size() + " xuống " + target
                        + " người: cần " + toRemove + " chỗ trống để bỏ đi nhưng phòng chỉ còn " + free.size()
                        + " chỗ trống. Các chỗ đang bận: " + describe(slots, busy)
                        + ". Sức chứa thấp nhất có thể đặt lúc này là " + busy.size() + ".");
            }
            free.subList(0, toRemove).forEach(slot -> {
                slot.markDeleted();
                roomSlotRepository.save(slot);
            });
            return;
        }
        Set<String> usedCodes = slots.stream().map(RoomSlot::getSlotCode).collect(Collectors.toSet());
        int next = slots.stream().mapToInt(s -> s.getSlotNumber() == null ? 0 : s.getSlotNumber()).max().orElse(0);
        for (int i = slots.size(); i < target; i++) {
            do next++; while (usedCodes.contains("S" + next));
            RoomSlot slot = new RoomSlot();
            slot.setRoomId(room.getId());
            slot.setSlotNumber(next);
            slot.setSlotCode("S" + next);
            slot.setStatus(RoomSlotStatus.AVAILABLE);
            // New slots are bookable right away (RoomSlot.availableFrom, Vietnam date).
            slot.setAvailableFrom(java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))));
            roomSlotRepository.save(slot);
        }
    }

    /** Every id must be a live entry of the same branch's room service catalog. */
    private List<String> validRoomServices(String branchId, List<String> ids) {
        if (ids == null || ids.isEmpty()) return new ArrayList<>();
        List<String> distinct = ids.stream().distinct().toList();
        long found = mongo.count(new org.springframework.data.mongodb.core.query.Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(),
                Criteria.where("_id").in(distinct.stream().map(MongoQueryHelper::toObjectId).toList()),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)))),
                com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService.class);
        if (found != distinct.size()) throw new BadRequestException("Có dịch vụ phòng không thuộc chi nhánh hoặc đã bị xoá");
        return new ArrayList<>(distinct);
    }

    /**
     * Slots that cannot be removed, with the reason: someone holds / lives in it (occupancy), a booking
     * request on it is still being processed, or a draft / running contract uses it.
     */
    private Map<String, String> busySlots(List<RoomSlot> slots) {
        Map<String, String> busy = new LinkedHashMap<>();
        if (slots.isEmpty()) return busy;
        List<String> ids = slots.stream().map(RoomSlot::getId).toList();
        List<ObjectId> objectIds = ids.stream().map(MongoQueryHelper::toObjectId).toList();
        Set<String> slotIds = Set.copyOf(ids);

        occupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(ids, HOLDING)
                .forEach(o -> busy.putIfAbsent(o.getRoomSlotId(),
                        o.getStatus() == OccupancyStatus.ACTIVE ? "đang có người ở" : "đang được giữ chỗ"));

        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));
        for (Contract c : mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                new Criteria().orOperator(Criteria.where("roomSlotId").in(objectIds), Criteria.where("roomSlotIds").in(objectIds)),
                Criteria.where("status").in(ContractStatus.DRAFT.name(), ContractStatus.ACTIVE.name()))), Contract.class)) {
            if (c.getStatus() == ContractStatus.ACTIVE && c.getEndDate() != null && !c.getEndDate().isAfter(today)) continue;
            String reason = c.getStatus() == ContractStatus.DRAFT ? "có hợp đồng đang chờ ký / duyệt" : "đang có người ở theo hợp đồng";
            slotIdsOf(c.getRoomSlotId(), c.getRoomSlotIds()).stream().filter(slotIds::contains)
                    .forEach(id -> busy.putIfAbsent(id, reason));
        }

        for (Booking b : mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                new Criteria().orOperator(Criteria.where("roomSlotId").in(objectIds), Criteria.where("roomSlotIds").in(objectIds)),
                Criteria.where("status").in(LIVE_BOOKINGS.stream().map(Enum::name).toList()))), Booking.class)) {
            slotIdsOf(b.getRoomSlotId(), b.getRoomSlotIds()).stream().filter(slotIds::contains)
                    .forEach(id -> busy.putIfAbsent(id, "có yêu cầu giữ chỗ đang xử lý"));
        }
        return busy;
    }

    private static List<String> slotIdsOf(String single, List<String> many) {
        List<String> all = new ArrayList<>();
        if (single != null) all.add(single);
        if (many != null) all.addAll(many);
        return all;
    }

    /** "S1 (đang có người ở), S3 (có yêu cầu giữ chỗ đang xử lý)" */
    private static String describe(List<RoomSlot> slots, Map<String, String> busy) {
        return slots.stream().filter(slot -> busy.containsKey(slot.getId()))
                .sorted(Comparator.comparing(slot -> slot.getSlotNumber() == null ? 0 : slot.getSlotNumber()))
                .map(slot -> slot.getSlotCode() + " (" + busy.get(slot.getId()) + ")")
                .collect(Collectors.joining(", "));
    }

    private void ensureUniqueNumber(Room room) {
        if (MongoQueryHelper.existsOther(mongo, Room.class, room.getId(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(room.getBranchId())),
                Criteria.where("roomNumber").is(room.getRoomNumber()))) {
            throw new ConflictException("Số phòng " + room.getRoomNumber() + " đã tồn tại trong chi nhánh");
        }
    }

    /** Admin may manage any branch; owner / manager only their own (BranchService also checks the branch exists). */
    private void requireAccess(String branchId, AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        if ("ADMIN".equals(principal.role())) {
            branches.getById(branchId);
            return;
        }
        branches.requireManagementAccess(branchId, principal);
    }
}
