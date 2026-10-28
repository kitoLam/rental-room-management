package com.kitolam.rentalroommanagement.modules.room.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.dto.response.PublicRoomResponse;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomMode;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomtype.document.RoomType;
import com.kitolam.rentalroommanagement.modules.roomtype.repository.RoomTypeRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PublicRoomService {

    private final RoomRepository rooms;
    private final BranchRepository branches;
    private final RoomTypeRepository roomTypes;
    private final MongoTemplate mongoTemplate;
    private final RoomService roomService;

    public PagedResponse<PublicRoomResponse> search(
            String branchId,
            String roomTypeId,
            String address,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer minCapacity,
            int page,
            int size,
            String sort
    ) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BadRequestException("Trang hoặc kích thước trang không hợp lệ");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new BadRequestException("Khoảng giá không hợp lệ");
        }

        List<Criteria> branchFilters = new ArrayList<>();
        branchFilters.add(Criteria.where("isDeleted").is(false));
        branchFilters.add(Criteria.where("status").is(BranchStatus.ACTIVE.name()));
        if (StringUtils.hasText(branchId)) {
            branchFilters.add(Criteria.where("id").is(MongoQueryHelper.toObjectId(branchId)));
        }
        if (StringUtils.hasText(address)) {
            branchFilters.add(Criteria.where("address").regex(Pattern.quote(address.trim()), "i"));
        }
        Criteria branchCriteria = new Criteria().andOperator(branchFilters);
        List<Branch> activeBranches = mongoTemplate.find(Query.query(branchCriteria), Branch.class);
        if (activeBranches.isEmpty()) {
            return PagedResponse.of(List.of(), page + 1, size, 0);
        }

        List<Criteria> roomFilters = new ArrayList<>();
        roomFilters.add(MongoQueryHelper.notDeleted());
        roomFilters.add(Criteria.where("status").is(RoomStatus.AVAILABLE.name()));
        roomFilters.add(Criteria.where("branchId")
                .in(activeBranches.stream().map(b -> new ObjectId(b.getId())).toList()));
        if (StringUtils.hasText(roomTypeId)) {
            roomFilters.add(Criteria.where("roomTypeId").is(MongoQueryHelper.toObjectId(roomTypeId)));
        }
        if (minPrice != null || maxPrice != null) {
            Criteria price = Criteria.where("listedRentPrice");
            if (minPrice != null) price.gte(minPrice);
            if (maxPrice != null) price.lte(maxPrice);
            roomFilters.add(price);
        }
        if (minCapacity != null) {
            if (minCapacity < 1) {
                throw new BadRequestException("Sức chứa tối thiểu phải lớn hơn 0");
            }
            roomFilters.add(Criteria.where("maxOccupants").gte(minCapacity));
        }

        Criteria roomCriteria = new Criteria().andOperator(roomFilters);
        Sort roomSort = parseSort(sort).and(Sort.by(Sort.Direction.ASC, "id"));
        long total = mongoTemplate.count(Query.query(roomCriteria), Room.class);
        Set<String> fullyOccupiedIds = fullyOccupiedPerSlotRoomIds(roomCriteria);
        List<Criteria> occupiedFilters = new ArrayList<>();
        occupiedFilters.add(roomCriteria);
        occupiedFilters.add(Criteria.where("id").in(fullyOccupiedIds.stream()
                .map(MongoQueryHelper::toObjectId).toList()));
        long fullyOccupiedCount = fullyOccupiedIds.isEmpty() ? 0
                : mongoTemplate.count(Query.query(new Criteria().andOperator(occupiedFilters)), Room.class);

        long availableCount = total - fullyOccupiedCount;
        long offset = (long) page * size;
        List<Room> pageRooms = new ArrayList<>(size);
        if (offset < availableCount) {
            List<Criteria> availableFilters = new ArrayList<>();
            availableFilters.add(roomCriteria);
            if (!fullyOccupiedIds.isEmpty()) {
                availableFilters.add(Criteria.where("id").nin(fullyOccupiedIds.stream()
                        .map(MongoQueryHelper::toObjectId).toList()));
            }
            int availableLimit = (int) Math.min(size, availableCount - offset);
            pageRooms.addAll(findRooms(new Criteria().andOperator(availableFilters), offset, availableLimit, roomSort));
            int remaining = size - pageRooms.size();
            if (remaining > 0 && fullyOccupiedCount > 0) {
                pageRooms.addAll(findRooms(new Criteria().andOperator(occupiedFilters), 0, remaining, roomSort));
            }
        } else if (fullyOccupiedCount > 0) {
            pageRooms.addAll(findRooms(new Criteria().andOperator(occupiedFilters),
                    offset - availableCount, size, roomSort));
        }
        Map<String, Branch> branchById = new HashMap<>();
        activeBranches.forEach(branch -> branchById.put(branch.getId(), branch));
        List<PublicRoomResponse> content = pageRooms.stream()
                .map(room -> toResponse(room, branchById.get(room.getBranchId()), false))
                .toList();
        return PagedResponse.of(content, page + 1, size, total);
    }

    public PublicRoomResponse getById(String id) {
        Room room = rooms.findByIdAndIsDeletedFalse(id)
                .filter(value -> value.getStatus() == RoomStatus.AVAILABLE)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng công khai"));
        Branch branch = branches.findByIdAndIsDeletedFalse(room.getBranchId())
                .filter(value -> value.getStatus() == BranchStatus.ACTIVE)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng công khai"));
        return toResponse(room, branch, true);
    }

    private Sort parseSort(String value) {
        String[] parts = StringUtils.hasText(value) ? value.split(",", 2) : new String[]{"code", "asc"};
        String property = switch (parts[0]) {
            case "referencePrice" -> "listedRentPrice";
            default -> "roomNumber";
        };
        Sort.Direction direction = parts.length > 1 && "desc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;
        return Sort.by(direction, property);
    }

    private Set<String> fullyOccupiedPerSlotRoomIds(Criteria roomCriteria) {
        Criteria perSlotCriteria = new Criteria().andOperator(roomCriteria,
                Criteria.where("roomMode").is(RoomMode.PER_SLOT.name()));
        List<Room> perSlotRooms = mongoTemplate.find(Query.query(perSlotCriteria), Room.class);
        if (perSlotRooms.isEmpty()) return Set.of();

        List<String> roomIds = perSlotRooms.stream().map(Room::getId).toList();
        List<RoomSlot> slots = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("isDeleted").is(false), Criteria.where("roomId").in(roomIds.stream()
                        .map(MongoQueryHelper::toObjectId).toList()))), RoomSlot.class);
        if (slots.isEmpty()) return Set.of();

        Map<String, Integer> slotCounts = new HashMap<>();
        Map<String, String> roomBySlotId = new HashMap<>();
        slots.forEach(slot -> {
            slotCounts.merge(slot.getRoomId(), 1, Integer::sum);
            roomBySlotId.put(slot.getId(), slot.getRoomId());
        });
        List<ObjectId> slotIds = slots.stream().map(slot -> MongoQueryHelper.toObjectId(slot.getId())).toList();
        List<RoomSlotOccupancy> occupancies = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("isDeleted").is(false),
                Criteria.where("status").is(OccupancyStatus.ACTIVE.name()),
                Criteria.where("roomSlotId").in(slotIds))), RoomSlotOccupancy.class);
        Set<String> occupiedSlotIds = new HashSet<>();
        Map<String, Integer> occupiedSlotCounts = new HashMap<>();
        occupancies.forEach(occupancy -> {
            String roomId = roomBySlotId.get(occupancy.getRoomSlotId());
            if (roomId != null && occupiedSlotIds.add(occupancy.getRoomSlotId())) {
                occupiedSlotCounts.merge(roomId, 1, Integer::sum);
            }
        });
        return occupiedSlotCounts.entrySet().stream()
                .filter(entry -> entry.getValue().equals(slotCounts.get(entry.getKey())))
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    private List<Room> findRooms(Criteria criteria, long skip, int limit, Sort sort) {
        if (limit <= 0) return List.of();
        Query query = Query.query(criteria).with(sort).skip(skip).limit(limit);
        return mongoTemplate.find(query, Room.class);
    }

    private PublicRoomResponse toResponse(Room room, Branch branch, boolean includeRates) {
        RoomType type = roomTypes.findByIdAndIsDeletedFalse(room.getRoomTypeId()).orElse(null);
        PublicRoomResponse.PublicRoom publicRoom = new PublicRoomResponse.PublicRoom(
                room.getId(),
                room.getBranchId(),
                room.getRoomTypeId(),
                room.getRoomNumber(),
                room.getRoomMode() == RoomMode.PER_SLOT ? "SLOT" : "ROOM",
                room.getMaxOccupants() == null ? 1 : room.getMaxOccupants(),
                room.getArea(),
                room.getFloor(),
                room.getListedRentPrice() == null ? BigDecimal.ZERO : room.getListedRentPrice(),
                null,
                room.getAmenities() == null ? List.of() : room.getAmenities(),
                room.getImages() == null ? List.of() : room.getImages(),
                "ACTIVE"
        );
        return new PublicRoomResponse(
                publicRoom,
                branch.getId(),
                branch.getName(),
                branch.getAddress() == null ? "" : branch.getAddress(),
                type == null ? "Phòng" : type.getName(),
                includeRates ? roomService.publicUtilityRates(room.getId()) : null
        );
    }
}
