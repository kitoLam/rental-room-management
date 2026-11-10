package com.kitolam.rentalroommanagement.modules.roomservicecharge.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.document.ChargeSegment;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.document.RoomServiceCharge;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.ChargeSegmentResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.RoomServiceChargeResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.repository.RoomServiceChargeRepository;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.service.RoomServiceChargeService;
import com.kitolam.rentalroommanagement.modules.serviceitem.document.ServiceItem;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.repository.ServiceItemRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RoomServiceChargeServiceImpl implements RoomServiceChargeService {

    private static final List<RoomServiceChargeStatus> BILLABLE =
            List.of(RoomServiceChargeStatus.CONFIRMED, RoomServiceChargeStatus.INVOICED);

    private final RoomServiceChargeRepository roomServiceChargeRepository;
    private final RoomServiceRepository roomServiceRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final RoomRepository roomRepository;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;

    @Override
    public RoomServiceChargeResponse create(RoomServiceChargeCreateRequest request, AuthPrincipal principal) {
        RoomService roomService = roomServiceRepository.findByIdAndIsDeletedFalse(request.roomServiceId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ phòng"));
        staffAccess.requireBranch(room(roomService.getRoomId()).getBranchId(), principal);
        ServiceItem service = serviceItemRepository.findByIdAndIsDeletedFalse(roomService.getServiceId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ"));
        if (service.getCalculationType() != CalculationType.METERED) {
            throw new BadRequestException("Chỉ dịch vụ tính theo đồng hồ mới cần nhập chỉ số");
        }
        if (roomServiceChargeRepository.findByRoomServiceIdAndPeriodAndIsDeletedFalse(roomService.getId(), request.period()).isPresent()) {
            throw new ConflictException("Đã nhập chỉ số cho dịch vụ này trong kỳ " + request.period());
        }

        BigDecimal previous = request.previousReading();
        if (previous == null) {
            previous = roomServiceChargeRepository
                    .findFirstByRoomServiceIdAndPeriodLessThanAndStatusInAndIsDeletedFalseOrderByPeriodDesc(
                            roomService.getId(), request.period(), BILLABLE)
                    .flatMap(last -> last.getSegments().stream().reduce((a, b) -> b))
                    .map(ChargeSegment::getCurrentReading)
                    .orElseThrow(() -> new BadRequestException("Chưa có chỉ số kỳ trước, vui lòng nhập previousReading"));
        }

        YearMonth period = YearMonth.parse(request.period());
        ChargeSegment segment = new ChargeSegment();
        segment.setId(new ObjectId().toHexString());
        segment.setStartAt(period.atDay(1));
        segment.setEndAt(period.plusMonths(1).atDay(1));
        segment.setPreviousReading(previous);
        segment.setCurrentReading(request.currentReading());
        segment.setUnitPrice(roomService.getUnitPrice());

        RoomServiceCharge charge = new RoomServiceCharge();
        charge.setRoomServiceId(roomService.getId());
        charge.setRoomId(roomService.getRoomId());
        charge.setPeriod(request.period());
        charge.getSegments().add(segment);
        recompute(charge);
        return toResponse(roomServiceChargeRepository.save(charge));
    }

    @Override
    public RoomServiceChargeResponse getById(String id, AuthPrincipal principal) {
        RoomServiceCharge charge = getEntity(id);
        staffAccess.requireBranch(room(charge.getRoomId()).getBranchId(), principal);
        return toResponse(charge);
    }

    @Override
    public PagedResponse<RoomServiceChargeResponse> search(RoomServiceChargeFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        if (branchIds != null) {
            List<ObjectId> roomIds = roomRepository.findByBranchIdInAndIsDeletedFalse(branchIds).stream()
                    .map(room -> new ObjectId(room.getId())).toList();
            criteria.add(Criteria.where("roomId").in(roomIds));
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "roomServiceId", filter.roomServiceId());
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addEquals(criteria, "period", filter.period());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        Page<RoomServiceCharge> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, RoomServiceCharge.class);
        return PagedResponse.from(page, this::toResponse);
    }

    @Override
    public RoomServiceChargeResponse update(String id, RoomServiceChargeUpdateRequest request, AuthPrincipal principal) {
        RoomServiceCharge charge = getEntity(id);
        staffAccess.requireBranch(room(charge.getRoomId()).getBranchId(), principal);
        requireDraft(charge);
        ChargeSegment segment = charge.getSegments().getFirst();
        if (request.previousReading() != null) segment.setPreviousReading(request.previousReading());
        if (request.currentReading() != null) segment.setCurrentReading(request.currentReading());
        recompute(charge);
        return toResponse(roomServiceChargeRepository.save(charge));
    }

    @Override
    public RoomServiceChargeResponse confirm(String id, AuthPrincipal principal) {
        RoomServiceCharge charge = getEntity(id);
        staffAccess.requireBranch(room(charge.getRoomId()).getBranchId(), principal);
        requireDraft(charge);
        charge.setStatus(RoomServiceChargeStatus.CONFIRMED);
        return toResponse(roomServiceChargeRepository.save(charge));
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        RoomServiceCharge charge = getEntity(id);
        staffAccess.requireBranch(room(charge.getRoomId()).getBranchId(), principal);
        requireDraft(charge);
        charge.markDeleted();
        roomServiceChargeRepository.save(charge);
    }

    /** usage = current - previous, amount = usage × unitPrice (whole VND). */
    private void recompute(RoomServiceCharge charge) {
        BigDecimal total = BigDecimal.ZERO;
        for (ChargeSegment segment : charge.getSegments()) {
            BigDecimal usage = segment.getCurrentReading().subtract(segment.getPreviousReading());
            if (usage.signum() < 0) {
                throw new BadRequestException("Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ");
            }
            segment.setUsage(usage);
            segment.setAmount(usage.multiply(segment.getUnitPrice()).setScale(0, RoundingMode.HALF_UP));
            total = total.add(segment.getAmount());
        }
        charge.setTotalAmount(total);
    }

    private void requireDraft(RoomServiceCharge charge) {
        if (charge.getStatus() != RoomServiceChargeStatus.DRAFT) {
            throw new ConflictException("Chỉ số đã chốt, không thể sửa hoặc xoá");
        }
    }

    private RoomServiceCharge getEntity(String id) {
        return roomServiceChargeRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chỉ số dịch vụ phòng với id: " + id));
    }

    private Room room(String roomId) {
        return roomRepository.findByIdAndIsDeletedFalse(roomId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng"));
    }

    private RoomServiceChargeResponse toResponse(RoomServiceCharge charge) {
        List<ChargeSegmentResponse> segments = charge.getSegments().stream()
                .map(s -> new ChargeSegmentResponse(s.getId(), s.getStartAt(), s.getEndAt(), s.getPreviousReading(),
                        s.getCurrentReading(), s.getUsage(), s.getUnitPrice(), s.getAmount(), List.of()))
                .toList();
        return new RoomServiceChargeResponse(charge.getId(), charge.getRoomServiceId(), charge.getRoomId(), charge.getPeriod(),
                charge.getStatus(), charge.getTotalAmount(), segments, charge.getCreatedAt(), charge.getUpdatedAt());
    }
}
