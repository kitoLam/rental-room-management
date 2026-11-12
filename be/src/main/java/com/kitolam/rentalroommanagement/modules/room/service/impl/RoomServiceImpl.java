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
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.repository.RoomSlotOccupancyRepository;
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

    private final RoomRepository roomRepository;
    private final RoomMapper mapper;
    private final BranchService branches;
    private final MongoTemplate mongo;
    private final Clock clock;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomSlotOccupancyRepository occupancyRepository;

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
        if (request.status() != null) room.setStatus(request.status());
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
        if (!heldSlotIds(slots).isEmpty()) {
            throw new ConflictException("Phòng đang có người giữ chỗ hoặc đang ở, không thể xoá");
        }
        slots.forEach(slot -> {
            slot.markDeleted();
            roomSlotRepository.save(slot);
        });
        room.markDeleted();
        roomRepository.save(room);
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
            List<RoomSlot> extra = slots.subList(target, slots.size());
            Set<String> held = heldSlotIds(extra);
            if (!held.isEmpty()) {
                throw new BadRequestException("Không thể giảm sức chứa xuống " + target
                        + " vì còn " + held.size() + " chỗ đang có người giữ hoặc đang ở");
            }
            extra.forEach(slot -> {
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

    private Set<String> heldSlotIds(List<RoomSlot> slots) {
        if (slots.isEmpty()) return Set.of();
        return occupancyRepository.findByRoomSlotIdInAndStatusInAndIsDeletedFalse(
                        slots.stream().map(RoomSlot::getId).toList(), HOLDING).stream()
                .map(RoomSlotOccupancy::getRoomSlotId)
                .collect(Collectors.toSet());
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
