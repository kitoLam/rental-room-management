package com.kitolam.rentalroommanagement.modules.furniture.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.furniture.document.Furniture;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureGroupUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureGroupResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureGroupRoomResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureResponse;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import com.kitolam.rentalroommanagement.modules.furniture.repository.FurnitureRepository;
import com.kitolam.rentalroommanagement.modules.furniture.service.FurnitureService;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.document.ReportRequestFurniture;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FurnitureServiceImpl implements FurnitureService {

    private final FurnitureRepository furnitureRepository;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongo;

    // ----- per room document

    @Override
    public FurnitureResponse getById(String id, AuthPrincipal principal) {
        Furniture item = getEntity(id);
        staffAccess.requireBranch(findRoom(item.getRoomId()).getBranchId(), principal);
        return toResponse(item);
    }

    @Override
    public PagedResponse<FurnitureResponse> search(FurnitureFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (filter.branchId() != null && !filter.branchId().isBlank()) {
            staffAccess.requireBranch(filter.branchId(), principal);
            criteria.add(Criteria.where("roomId").in(roomIdsOfBranches(List.of(filter.branchId()))));
        } else {
            Set<String> branchIds = staffAccess.manageableBranchIds(principal);
            if (branchIds != null) criteria.add(Criteria.where("roomId").in(roomIdsOfBranches(branchIds)));
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addEquals(criteria, "condition", filter.condition());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "name");
        return PagedResponse.from(MongoQueryHelper.page(mongo, criteria, pageable, Furniture.class), this::toResponse);
    }

    @Override
    public FurnitureResponse update(String id, FurnitureUpdateRequest request, AuthPrincipal principal) {
        Furniture item = getEntity(id);
        Room oldRoom = findRoom(item.getRoomId());
        staffAccess.requireBranch(oldRoom.getBranchId(), principal);
        String oldName = item.getName();
        String oldRoomId = item.getRoomId();
        if (request.roomId() != null && !request.roomId().equals(oldRoomId)) {
            Room target = findRoom(request.roomId());
            if (!oldRoom.getBranchId().equals(target.getBranchId())) {
                throw new BadRequestException("Chỉ chuyển được sang phòng cùng chi nhánh");
            }
            item.setRoomId(target.getId());
        }
        if (request.name() != null) item.setName(request.name().trim());
        if (request.quantity() != null) item.setQuantity(request.quantity());
        if (request.condition() != null) item.setCondition(request.condition());
        if (MongoQueryHelper.existsOther(mongo, Furniture.class, item.getId(),
                Criteria.where("roomId").is(MongoQueryHelper.toObjectId(item.getRoomId())),
                Criteria.where("name").is(item.getName()))) {
            throw new ConflictException("Phòng đã có cơ sở vật chất tên \"" + item.getName() + "\"");
        }
        Furniture saved = furnitureRepository.save(item);
        if (!oldName.equals(saved.getName()) || !oldRoomId.equals(saved.getRoomId())) {
            pullName(List.of(oldRoomId), oldName);
            addName(List.of(saved.getRoomId()), saved.getName());
        }
        return toResponse(saved);
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        Furniture item = getEntity(id);
        staffAccess.requireBranch(findRoom(item.getRoomId()).getBranchId(), principal);
        item.markDeleted();
        furnitureRepository.save(item);
        pullName(List.of(item.getRoomId()), item.getName());
    }

    // ----- grouped by name

    @Override
    public FurnitureGroupResponse create(FurnitureCreateRequest request, AuthPrincipal principal) {
        staffAccess.requireBranch(request.branchId(), principal);
        String name = request.name().trim();
        Map<String, Room> rooms = branchRooms(request.branchId());
        Set<String> roomIds = validRoomIds(rooms, request.roomIds());
        if (!docsOf(rooms.keySet(), name).isEmpty()) {
            throw new ConflictException("Chi nhánh đã có cơ sở vật chất tên \"" + name + "\", hãy chỉnh sửa mục đó");
        }
        for (String roomId : roomIds) {
            furnitureRepository.save(newDoc(roomId, name, request.quantity(), request.condition()));
        }
        addName(roomIds, name);
        return group(request.branchId(), name, rooms);
    }

    @Override
    public List<FurnitureGroupResponse> groups(String branchId, String keyword, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        Map<String, Room> rooms = branchRooms(branchId);
        if (rooms.isEmpty()) return List.of();
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("roomId").in(objectIds(rooms.keySet())));
        MongoQueryHelper.addKeyword(criteria, keyword, "name");
        List<Furniture> docs = mongo.find(new Query(new Criteria().andOperator(criteria)), Furniture.class);
        Map<String, List<Furniture>> byName = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        docs.forEach(f -> byName.computeIfAbsent(f.getName(), k -> new ArrayList<>()).add(f));
        Map<String, Long> reports = reportCounts(docs);
        return byName.entrySet().stream()
                .map(e -> toGroup(branchId, e.getKey(), e.getValue(), rooms, reports))
                .toList();
    }

    @Override
    public FurnitureGroupResponse updateGroup(FurnitureGroupUpdateRequest request, AuthPrincipal principal) {
        staffAccess.requireBranch(request.branchId(), principal);
        String oldName = request.name().trim();
        String newName = request.newName() == null ? oldName : request.newName().trim();
        Map<String, Room> rooms = branchRooms(request.branchId());
        List<Furniture> current = docsOf(rooms.keySet(), oldName);
        if (current.isEmpty()) throw new NotFoundException("Không tìm thấy cơ sở vật chất \"" + oldName + "\"");
        boolean renamed = !oldName.equals(newName);
        if (renamed && !docsOf(rooms.keySet(), newName).isEmpty()) {
            throw new ConflictException("Chi nhánh đã có cơ sở vật chất tên \"" + newName + "\"");
        }
        Set<String> target = request.roomIds() == null
                ? current.stream().map(Furniture::getRoomId).collect(Collectors.toCollection(LinkedHashSet::new))
                : validRoomIds(rooms, request.roomIds());
        if (target.isEmpty()) throw new BadRequestException("Phải chọn ít nhất một phòng, hoặc xoá cơ sở vật chất này");

        Set<String> pullRooms = new LinkedHashSet<>();
        Set<String> existing = new LinkedHashSet<>();
        for (Furniture f : current) {
            existing.add(f.getRoomId());
            if (!target.contains(f.getRoomId())) {
                f.markDeleted();
                furnitureRepository.save(f);
                pullRooms.add(f.getRoomId());
                continue;
            }
            if (renamed) {
                f.setName(newName);
                pullRooms.add(f.getRoomId());
            }
            if (request.quantity() != null) f.setQuantity(request.quantity());
            if (request.condition() != null) f.setCondition(request.condition());
            furnitureRepository.save(f);
        }
        for (String roomId : target) {
            if (!existing.contains(roomId)) {
                furnitureRepository.save(newDoc(roomId, newName, request.quantity(), request.condition()));
            }
        }
        pullName(pullRooms, oldName);
        addName(target, newName);
        return group(request.branchId(), newName, rooms);
    }

    @Override
    public void deleteGroup(String branchId, String name, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        String trimmed = name.trim();
        List<Furniture> docs = docsOf(branchRooms(branchId).keySet(), trimmed);
        if (docs.isEmpty()) throw new NotFoundException("Không tìm thấy cơ sở vật chất \"" + trimmed + "\"");
        for (Furniture f : docs) {
            f.markDeleted();
            furnitureRepository.save(f);
        }
        pullName(docs.stream().map(Furniture::getRoomId).toList(), trimmed);
    }

    // ----- helpers

    private Furniture getEntity(String id) {
        return furnitureRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy cơ sở vật chất với id: " + id));
    }

    private Room findRoom(String roomId) {
        Room room = mongo.findOne(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("id").is(MongoQueryHelper.toObjectId(roomId)))), Room.class);
        if (room == null) throw new NotFoundException("Không tìm thấy phòng với id: " + roomId);
        return room;
    }

    /** Live rooms of the branch by id, in room-number order. */
    private Map<String, Room> branchRooms(String branchId) {
        List<Room> rooms = mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("branchId").is(MongoQueryHelper.toObjectId(branchId)))), Room.class);
        rooms.sort(Comparator.comparing(r -> r.getRoomNumber() == null ? "" : r.getRoomNumber()));
        Map<String, Room> map = new LinkedHashMap<>();
        rooms.forEach(r -> map.put(r.getId(), r));
        return map;
    }

    private List<ObjectId> roomIdsOfBranches(Collection<String> branchIds) {
        List<ObjectId> ids = branchIds.stream().map(MongoQueryHelper::toObjectId).toList();
        return mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("branchId").in(ids))), Room.class)
                .stream().map(r -> new ObjectId(r.getId())).toList();
    }

    private static Set<String> validRoomIds(Map<String, Room> rooms, Collection<String> roomIds) {
        Set<String> ids = new LinkedHashSet<>(roomIds);
        if (!rooms.keySet().containsAll(ids)) {
            throw new BadRequestException("Có phòng không tồn tại hoặc không thuộc chi nhánh này");
        }
        return ids;
    }

    private static List<ObjectId> objectIds(Collection<String> ids) {
        return ids.stream().map(ObjectId::new).toList();
    }

    private List<Furniture> docsOf(Collection<String> roomIds, String name) {
        if (roomIds.isEmpty()) return List.of();
        return mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                Criteria.where("roomId").in(objectIds(roomIds)), Criteria.where("name").is(name))), Furniture.class);
    }

    private static Furniture newDoc(String roomId, String name, Integer quantity, FurnitureCondition condition) {
        Furniture f = new Furniture();
        f.setRoomId(roomId);
        f.setName(name);
        f.setQuantity(quantity == null ? 1 : quantity);
        f.setCondition(condition == null ? FurnitureCondition.GOOD : condition);
        return f;
    }

    // Room.amenities sync: only this name is added / removed, other entries stay as they are.

    private void addName(Collection<String> roomIds, String name) {
        if (roomIds.isEmpty()) return;
        mongo.updateMulti(new Query(Criteria.where("id").in(objectIds(roomIds))),
                new Update().addToSet("amenities", name).set("updatedAt", Instant.now()), Room.class);
    }

    private void pullName(Collection<String> roomIds, String name) {
        if (roomIds.isEmpty()) return;
        mongo.updateMulti(new Query(Criteria.where("id").in(objectIds(roomIds))),
                new Update().pull("amenities", name).set("updatedAt", Instant.now()), Room.class);
    }

    // ----- responses

    private FurnitureResponse toResponse(Furniture f) {
        return new FurnitureResponse(f.getId(), f.getRoomId(), f.getName(), f.getQuantity(), f.getCondition(),
                f.getCreatedAt(), f.getUpdatedAt());
    }

    private FurnitureGroupResponse group(String branchId, String name, Map<String, Room> rooms) {
        List<Furniture> docs = docsOf(rooms.keySet(), name);
        return toGroup(branchId, name, docs, rooms, reportCounts(docs));
    }

    private FurnitureGroupResponse toGroup(String branchId, String name, List<Furniture> docs,
                                           Map<String, Room> rooms, Map<String, Long> reports) {
        List<FurnitureGroupRoomResponse> items = docs.stream()
                .sorted(Comparator.comparing(f -> rooms.get(f.getRoomId()) == null
                        || rooms.get(f.getRoomId()).getRoomNumber() == null ? "" : rooms.get(f.getRoomId()).getRoomNumber()))
                .map(f -> {
                    Room room = rooms.get(f.getRoomId());
                    return new FurnitureGroupRoomResponse(f.getId(), f.getRoomId(),
                            room == null ? null : room.getRoomNumber(), room == null ? null : room.getTitle(),
                            f.getQuantity(), f.getCondition(), reports.getOrDefault(f.getId(), 0L));
                }).toList();
        int total = docs.stream().mapToInt(f -> f.getQuantity() == null ? 0 : f.getQuantity()).sum();
        return new FurnitureGroupResponse(branchId, name, total, items);
    }

    /** Report requests (module reportrequestfurniture) that mention each furniture. */
    private Map<String, Long> reportCounts(Collection<Furniture> docs) {
        if (docs.isEmpty()) return Map.of();
        List<String> ids = docs.stream().map(Furniture::getId).toList();
        return mongo.find(new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(),
                        Criteria.where("furnitureId").in(ids))), ReportRequestFurniture.class).stream()
                .collect(Collectors.groupingBy(ReportRequestFurniture::getFurnitureId, Collectors.counting()));
    }
}
