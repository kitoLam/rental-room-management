package com.kitolam.rentalroommanagement.modules.room.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
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
import com.kitolam.rentalroommanagement.modules.roomtype.dto.response.RoomTypeResponse;
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
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicRoomService {

    private final RoomRepository rooms;
    private final BranchRepository branches;
    private final RoomTypeRepository roomTypes;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final RoomService roomService;

    public PagedResponse<PublicRoomResponse> search(
            String keyword,
            String branchId,
            String roomTypeId,
            String address,
            String roomMode,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal minArea,
            BigDecimal maxArea,
            Integer minCapacity,
            int page,
            int size,
            String sort
    ) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BadRequestException("Trang hoặc kích thước trang không hợp lệ");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new BadRequestException("Khoảng giá không hợp lệ (giá tối thiểu không được lớn hơn giá tối đa)");
        }
        if (minArea != null && maxArea != null && minArea.compareTo(maxArea) > 0) {
            throw new BadRequestException("Khoảng diện tích không hợp lệ (diện tích tối thiểu không được lớn hơn tối đa)");
        }

        List<Criteria> branchFilters = new ArrayList<>();
        branchFilters.add(Criteria.where("isDeleted").is(false));
        branchFilters.add(Criteria.where("status").is(BranchStatus.ACTIVE.name()));
        if (StringUtils.hasText(branchId)) {
            branchFilters.add(Criteria.where("id").is(MongoQueryHelper.toObjectId(branchId)));
        }
        if (StringUtils.hasText(address)) {
            branchFilters.add(Criteria.where("address").regex(toVietnameseRegexPattern(address.trim()), "i"));
        }
        Criteria branchCriteria = new Criteria().andOperator(branchFilters);
        List<Branch> activeBranches = mongoTemplate.find(Query.query(branchCriteria), Branch.class);
        if (activeBranches.isEmpty()) {
            return PagedResponse.of(List.of(), page + 1, size, 0);
        }

        // Lấy danh sách loại phòng và chủ phòng để phục vụ map và tìm kiếm
        List<RoomType> allRoomTypes = roomTypes.findAll().stream()
                .filter(rt -> !Boolean.TRUE.equals(rt.getIsDeleted()))
                .toList();

        Set<String> ownerIds = activeBranches.stream()
                .map(Branch::getOwnerAccountId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());
        List<User> owners = userRepository.findAllById(ownerIds);
        Map<String, User> ownerById = owners.stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        List<Criteria> roomFilters = new ArrayList<>();
        roomFilters.add(MongoQueryHelper.notDeleted());
        roomFilters.add(Criteria.where("status").is(RoomStatus.AVAILABLE.name()));
        roomFilters.add(Criteria.where("branchId")
                .in(activeBranches.stream().map(b -> new ObjectId(b.getId())).toList()));

        // 1. Tìm kiếm tổng hợp theo từng chữ (tên phòng, mã phòng, chủ đăng bài, địa chỉ đăng phòng)
        if (StringUtils.hasText(keyword)) {
            String[] tokens = keyword.trim().split("\\s+");
            for (String token : tokens) {
                if (token.isBlank()) continue;
                String regexPattern = toVietnameseRegexPattern(token);
                Pattern compiled = Pattern.compile(regexPattern, Pattern.CASE_INSENSITIVE);

                // Chủ nhà có tên khớp với từ khóa
                Set<String> matchingOwnerIds = owners.stream()
                        .filter(o -> o.getFullName() != null && compiled.matcher(o.getFullName()).find())
                        .map(User::getId)
                        .collect(Collectors.toSet());

                // Chi nhánh có tên, địa chỉ hoặc chủ nhà khớp từ khóa
                Set<ObjectId> matchingBranchIds = activeBranches.stream()
                        .filter(b -> (b.getName() != null && compiled.matcher(b.getName()).find())
                                || (b.getAddress() != null && compiled.matcher(b.getAddress()).find())
                                || (b.getOwnerAccountId() != null && matchingOwnerIds.contains(b.getOwnerAccountId())))
                        .map(b -> MongoQueryHelper.toObjectId(b.getId()))
                        .collect(Collectors.toSet());

                // Loại phòng có tên khớp từ khóa
                Set<ObjectId> matchingRoomTypeIds = allRoomTypes.stream()
                        .filter(rt -> rt.getName() != null && compiled.matcher(rt.getName()).find())
                        .map(rt -> MongoQueryHelper.toObjectId(rt.getId()))
                        .collect(Collectors.toSet());

                List<Criteria> tokenMatches = new ArrayList<>();
                // Khớp mã số phòng
                tokenMatches.add(Criteria.where("roomNumber").regex(regexPattern, "i"));
                if (!matchingBranchIds.isEmpty()) {
                    tokenMatches.add(Criteria.where("branchId").in(matchingBranchIds));
                }
                if (!matchingRoomTypeIds.isEmpty()) {
                    tokenMatches.add(Criteria.where("roomTypeId").in(matchingRoomTypeIds));
                }

                roomFilters.add(new Criteria().orOperator(tokenMatches));
            }
        }

        // 2. Lọc theo Loại phòng
        if (StringUtils.hasText(roomTypeId)) {
            roomFilters.add(Criteria.where("roomTypeId").is(MongoQueryHelper.toObjectId(roomTypeId)));
        }

        // 3. Lọc theo Hình thức (Nhà riêng / Căn hộ nguyên căn vs Ở ghép theo slot)
        if (StringUtils.hasText(roomMode) && !"ALL".equalsIgnoreCase(roomMode)) {
            RoomMode mode = "SLOT".equalsIgnoreCase(roomMode) || "PER_SLOT".equalsIgnoreCase(roomMode)
                    ? RoomMode.PER_SLOT : RoomMode.WHOLE_ROOM;
            roomFilters.add(Criteria.where("roomMode").is(mode.name()));
        }

        // 4. Lọc kéo khoảng giá (500.000 - 20.000.000)
        if (minPrice != null || maxPrice != null) {
            Criteria price = Criteria.where("listedRentPrice");
            if (minPrice != null) price.gte(minPrice);
            if (maxPrice != null) price.lte(maxPrice);
            roomFilters.add(price);
        }

        // 5. Lọc kéo khoảng diện tích (10m2 - 100m2)
        if (minArea != null || maxArea != null) {
            Criteria area = Criteria.where("area");
            if (minArea != null) area.gte(minArea);
            if (maxArea != null) area.lte(maxArea);
            roomFilters.add(area);
        }

        // 6. Lọc sức chứa tối thiểu
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
                .map(room -> {
                    Branch branch = branchById.get(room.getBranchId());
                    User owner = branch != null ? ownerById.get(branch.getOwnerAccountId()) : null;
                    return toResponse(room, branch, owner, false);
                })
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
        User owner = branch.getOwnerAccountId() != null ? userRepository.findByIdAndIsDeletedFalse(branch.getOwnerAccountId()).orElse(null) : null;
        return toResponse(room, branch, owner, true);
    }

    public List<RoomTypeResponse> getPublicRoomTypes() {
        return roomTypes.findAll().stream()
                .filter(rt -> !Boolean.TRUE.equals(rt.getIsDeleted()))
                .map(rt -> new RoomTypeResponse(rt.getId(), rt.getName(), rt.getDescription(), rt.getCreatedAt(), rt.getUpdatedAt()))
                .toList();
    }

    public List<BranchResponse> getPublicBranches() {
        return branches.findAll().stream()
                .filter(b -> !Boolean.TRUE.equals(b.getIsDeleted()) && b.getStatus() == BranchStatus.ACTIVE)
                .map(b -> new BranchResponse(
                        b.getId(), b.getName(), b.getAddress(), b.getPhone(), b.getEmail(),
                        b.getDescription(), b.getStatus(), b.getCreatedAt(), b.getUpdatedAt(),
                        b.getOwnerAccountId(), b.getElectricityRate(), b.getWaterRate(), b.getParkingRate()
                ))
                .toList();
    }

    private Sort parseSort(String value) {
        if (!StringUtils.hasText(value)) {
            return Sort.by(Sort.Direction.ASC, "roomNumber");
        }
        String separator = value.contains("-") ? "-" : ",";
        String[] parts = value.split(separator, 2);
        String field = parts[0].trim();
        String dir = parts.length > 1 ? parts[1].trim() : "asc";

        String property = switch (field) {
            case "referencePrice", "price" -> "listedRentPrice";
            case "area", "size" -> "area";
            case "createdAt", "newest" -> "createdAt";
            default -> "roomNumber";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(dir) ? Sort.Direction.DESC : Sort.Direction.ASC;
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
                Criteria.where("status").in(List.of(
                        OccupancyStatus.RESERVED.name(), OccupancyStatus.ACTIVE.name())),
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

    private PublicRoomResponse toResponse(Room room, Branch branch, User owner, boolean includeRates) {
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
                branch != null ? branch.getId() : "",
                branch != null ? branch.getName() : "",
                branch != null && branch.getAddress() != null ? branch.getAddress() : "",
                type == null ? "Phòng" : type.getName(),
                owner != null ? owner.getFullName() : "",
                includeRates ? roomService.publicUtilityRates(room.getId()) : null
        );
    }

    /**
     * Chuyển đổi từ khóa tìm kiếm tiếng Việt thành biểu thức Regex hỗ trợ cả có dấu và không dấu
     */
    public static String toVietnameseRegexPattern(String input) {
        if (input == null || input.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : input.toCharArray()) {
            char lower = Character.toLowerCase(c);
            switch (lower) {
                case 'a', 'à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ', 'â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ' ->
                        sb.append("[aàáảãạăằắẳẵặâầấẩẫậ]");
                case 'd', 'đ' -> sb.append("[dđ]");
                case 'e', 'è', 'é', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ề', 'ế', 'ể', 'ễ', 'ệ' ->
                        sb.append("[eèéẻẽẹêềếểễệ]");
                case 'i', 'ì', 'í', 'ỉ', 'ĩ', 'ị' -> sb.append("[iìíỉĩị]");
                case 'o', 'ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ', 'ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ' ->
                        sb.append("[oòóỏõọôồốổỗộơờớởỡợ]");
                case 'u', 'ù', 'ú', 'ủ', 'ũ', 'ụ', 'ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự' ->
                        sb.append("[uùúủũụưừứửữự]");
                case 'y', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ' -> sb.append("[yỳýỷỹỵ]");
                default -> {
                    if ("\\^$.|?*+()[]{}".indexOf(c) != -1) {
                        sb.append('\\').append(c);
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }
}
