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
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomtype.document.RoomType;
import com.kitolam.rentalroommanagement.modules.roomtype.repository.RoomTypeRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

        Pageable pageable = PageRequest.of(page, size, parseSort(sort));
        Page<Room> result = rooms.findWithPagination(new Criteria().andOperator(roomFilters), pageable);
        Map<String, Branch> branchById = new HashMap<>();
        activeBranches.forEach(branch -> branchById.put(branch.getId(), branch));
        List<PublicRoomResponse> content = result.getContent().stream()
                .map(room -> toResponse(room, branchById.get(room.getBranchId()), false))
                .toList();
        return PagedResponse.of(content, result.getNumber() + 1, size, result.getTotalElements());
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

    private PublicRoomResponse toResponse(Room room, Branch branch, boolean includeRates) {
        RoomType type = roomTypes.findByIdAndIsDeletedFalse(room.getRoomTypeId()).orElse(null);
        PublicRoomResponse.PublicRoom publicRoom = new PublicRoomResponse.PublicRoom(
                room.getId(),
                room.getBranchId(),
                room.getRoomTypeId(),
                room.getRoomNumber(),
                "ROOM",
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
