package com.kitolam.rentalroommanagement.modules.reportrequest.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.reportrecord.document.ReportRecord;
import com.kitolam.rentalroommanagement.modules.reportrecord.dto.response.ReportRecordResponse;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrecord.repository.ReportRecordRepository;
import com.kitolam.rentalroommanagement.modules.reportrequest.document.ReportRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestAssignRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestInfoRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestProgressRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestRejectRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestReopenRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestSupplementRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestUpdateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.repository.ReportRequestRepository;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.document.ReportRequestFurniture;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.repository.ReportRequestFurnitureRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.document.ReportRequestServiceItem;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.repository.ReportRequestServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceImpl implements ReportRequestService {
    @Override
    public java.util.List<TenantSupport> readForTenantOverview(java.util.List<String> tenantIds, String contractId) {
        if (tenantIds.isEmpty() || contractId == null) return java.util.List.of();
        var query = MongoQueryHelper.byReferenceIds("tenantId", tenantIds);
        var values = new java.util.ArrayList<Object>();
        values.add(contractId);
        if (org.bson.types.ObjectId.isValid(contractId)) values.add(new org.bson.types.ObjectId(contractId));
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("contractId").in(values));
        query.fields().include("title", "status", "updatedAt");
        return mongoTemplate.find(query, ReportRequest.class).stream().map(item -> new TenantSupport(item.getId(),
                item.getTitle(), item.getStatus(), item.getUpdatedAt())).toList();
    }

    private static final int MAX_ATTACHMENTS = 5;
    private static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    private final ReportRequestRepository reportRequestRepository;
    private final ReportRecordRepository reportRecordRepository;
    private final ReportRequestFurnitureRepository reportRequestFurnitureRepository;
    private final ReportRequestServiceItemRepository reportRequestServiceItemRepository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final ManagerRepository managerRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    @Transactional
    public ReportRequestResponse create(ReportRequestCreateRequest request, AuthPrincipal principal) {
        requireRole(principal, "TENANT", "OWNER");
        Tenant tenant = resolveTenant(principal, request.tenantId());
        Room room = null;
        if (StringUtils.hasText(request.roomId())) {
            try {
                room = roomRepository.findByIdAndIsDeletedFalse(request.roomId()).orElse(null);
            } catch (Exception ignored) {
                // Ignore invalid ObjectId conversion when roomId is a frontend UUID
            }
        }

        // 1. Kiểm tra Hợp đồng có hiệu lực của chính khách thuê đang đăng nhập
        String targetRoomId = room != null ? room.getId() : request.roomId();
        Contract validContract = findActiveContract(tenant.getId(), targetRoomId);
        if (validContract == null && principal != null && StringUtils.hasText(principal.userId())
                && !principal.userId().equals(tenant.getId())) {
            validContract = findActiveContract(principal.userId(), targetRoomId);
        }
        if (validContract == null) {
            throw new BadRequestException("Bạn không có hợp đồng đang có hiệu lực cho phòng này.");
        }

        if (room == null && StringUtils.hasText(validContract.getRoomId())) {
            try {
                room = roomRepository.findByIdAndIsDeletedFalse(validContract.getRoomId()).orElse(null);
            } catch (Exception ignored) {
            }
        }

        String resolvedRoomId = room != null && StringUtils.hasText(room.getId())
                ? room.getId()
                : (StringUtils.hasText(validContract.getRoomId()) ? validContract.getRoomId() : request.roomId());
        String resolvedBranchId = room != null && StringUtils.hasText(room.getBranchId()) ? room.getBranchId() : null;

        // 2. Validate ảnh đinh kèm
        validateAttachments(request.attachments());

        // 3. Tự động gán Manager theo khu trọ
        String assignedManagerId = resolveManager(room, validContract);

        // 4. Ghi nhận yêu cầu (Mới)
        ReportRequest entity = new ReportRequest();
        entity.setTenantId(tenant.getId());
        entity.setRoomId(resolvedRoomId);
        entity.setBranchId(resolvedBranchId);
        entity.setContractId(validContract.getId());
        entity.setManagerId(assignedManagerId);
        entity.setType(request.type());
        entity.setTitle(request.title().trim());
        entity.setContent(request.content().trim());
        if (request.attachments() != null) {
            entity.setAttachments(request.attachments());
        }
        entity.setPriority(request.priority() != null ? request.priority() : ReportRequestPriority.MEDIUM);
        entity.setStatus(ReportRequestStatus.PENDING);

        ReportRequest saved = reportRequestRepository.save(entity);

        // Lưu liên kết đồ đạc nội thất nếu có
        if (request.furnitureIds() != null && !request.furnitureIds().isEmpty()) {
            for (String furnitureId : request.furnitureIds()) {
                if (StringUtils.hasText(furnitureId)) {
                    ReportRequestFurniture rrf = new ReportRequestFurniture();
                    rrf.setReportRequestId(saved.getId());
                    rrf.setFurnitureId(furnitureId.trim());
                    rrf.setIssueDescription(request.title().trim());
                    reportRequestFurnitureRepository.save(rrf);
                }
            }
        }

        // Lưu liên kết dịch vụ nếu có
        if (request.serviceIds() != null && !request.serviceIds().isEmpty()) {
            for (String serviceId : request.serviceIds()) {
                if (StringUtils.hasText(serviceId)) {
                    ReportRequestServiceItem rrs = new ReportRequestServiceItem();
                    rrs.setReportRequestId(saved.getId());
                    rrs.setRoomServiceId(serviceId.trim());
                    rrs.setNote(request.title().trim());
                    reportRequestServiceItemRepository.save(rrs);
                }
            }
        }

        // 5. Lưu lịch sử ReportRecord khởi tạo
        createRecord(
                saved.getId(),
                principal != null ? principal.userId() : tenant.getId(),
                "TENANT",
                principal != null && StringUtils.hasText(principal.fullName()) ? principal.fullName() : tenant.getFullName(),
                assignedManagerId,
                ReportRecordAction.CREATED,
                null,
                ReportRequestStatus.PENDING,
                "Khách thuê tạo yêu cầu hỗ trợ mới",
                saved.getAttachments()
        );

        if (assignedManagerId != null) {
            createRecord(
                    saved.getId(),
                    "SYSTEM",
                    "SYSTEM",
                    "Hệ thống",
                    assignedManagerId,
                    ReportRecordAction.ASSIGNED,
                    ReportRequestStatus.PENDING,
                    ReportRequestStatus.PENDING,
                    "Hệ thống tự động gán Quản lý phụ trách theo khu trọ",
                    List.of()
            );
        }

        return getById(saved.getId(), principal);
    }

    @Override
    public ReportRequestResponse getById(String id, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanView(report, principal);
        List<ReportRecordResponse> timeline = reportRecordRepository
                .findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(report.getId())
                .stream()
                .map(ReportRecordResponse::from)
                .toList();
        return buildResponse(report, timeline);
    }

    @Override
    public PagedResponse<ReportRequestResponse> search(ReportRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> baseFilterCriteria = MongoQueryHelper.baseCriteria();

        if (filter != null) {
            MongoQueryHelper.addEquals(baseFilterCriteria, "type", filter.type());
            MongoQueryHelper.addEquals(baseFilterCriteria, "priority", filter.priority());
            MongoQueryHelper.addEquals(baseFilterCriteria, "status", filter.status());
            MongoQueryHelper.addKeyword(baseFilterCriteria, filter.keyword(), "title", "content");
            if (StringUtils.hasText(filter.tenantId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "tenantId", filter.tenantId());
            }
            if (StringUtils.hasText(filter.roomId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "roomId", filter.roomId());
            }
            if (StringUtils.hasText(filter.contractId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "contractId", filter.contractId());
            }
            if (StringUtils.hasText(filter.managerId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "managerId", filter.managerId());
            }
            if (StringUtils.hasText(filter.branchId())) {
                addBranchFilter(baseFilterCriteria, List.of(filter.branchId()));
            }
        }

        List<Criteria> roleScopedCriteria = new ArrayList<>(baseFilterCriteria);

        // Kiểm tra quyền lọc dữ liệu theo vai trò
        if (principal != null) {
            if ("TENANT".equals(principal.role())) {
                Set<String> tenantActorIds = collectTenantActorIds(principal);
                if (!tenantActorIds.isEmpty()) {
                    roleScopedCriteria.add(Criteria.where("tenantId").in(toIdValues(tenantActorIds)));
                } else {
                    roleScopedCriteria.add(Criteria.where("tenantId").exists(false));
                }
            } else if ("MANAGER".equals(principal.role())) {
                Manager manager = findManagerByEmail(principal.email());
                if (manager == null && StringUtils.hasText(principal.userId())) {
                    try {
                        manager = managerRepository.findByIdAndIsDeletedFalse(principal.userId()).orElse(null);
                    } catch (Exception ignored) {
                    }
                }
                List<Criteria> managerCriteria = new ArrayList<>();
                Set<String> managerActorIds = new LinkedHashSet<>();
                if (manager != null && StringUtils.hasText(manager.getId())) {
                    managerActorIds.add(manager.getId());
                }
                if (StringUtils.hasText(principal.userId())) {
                    managerActorIds.add(principal.userId());
                }
                if (!managerActorIds.isEmpty()) {
                    managerCriteria.add(Criteria.where("managerId").in(toIdValues(managerActorIds)));
                }
                if (manager != null && StringUtils.hasText(manager.getBranchId())) {
                    addBranchFilter(managerCriteria, List.of(manager.getBranchId()));
                }
                // Cho phép lấy cả những yêu cầu chưa được gán branchId/managerId
                managerCriteria.add(new Criteria().andOperator(
                        new Criteria().orOperator(Criteria.where("branchId").is(null), Criteria.where("branchId").exists(false)),
                        new Criteria().orOperator(Criteria.where("managerId").is(null), Criteria.where("managerId").exists(false))
                ));
                if (!managerCriteria.isEmpty()) {
                    roleScopedCriteria.add(new Criteria().orOperator(managerCriteria.toArray(new Criteria[0])));
                }
            } else if ("OWNER".equals(principal.role())) {
                List<String> ownerBranchIds = findOwnerBranchIds(principal.userId());
                if (!ownerBranchIds.isEmpty()) {
                    List<Criteria> ownerCriteria = new ArrayList<>();
                    addBranchFilter(ownerCriteria, ownerBranchIds);
                    if (StringUtils.hasText(principal.userId())) {
                        ownerCriteria.add(Criteria.where("managerId").in(toIdValues(Set.of(principal.userId()))));
                    }
                    roleScopedCriteria.add(new Criteria().orOperator(ownerCriteria.toArray(new Criteria[0])));
                }
            }
            // ADMIN xem được tất cả
        }

        Page<ReportRequest> page = MongoQueryHelper.page(mongoTemplate, roleScopedCriteria, pageable, ReportRequest.class);

        return PagedResponse.from(page.map(r -> {
            List<ReportRecordResponse> timeline = reportRecordRepository
                    .findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(r.getId())
                    .stream()
                    .map(ReportRecordResponse::from)
                    .toList();
            return buildResponse(r, timeline);
        }));
    }

    @Override
    @Transactional
    public ReportRequestResponse startProcessing(String id, ReportRequestAssignRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING && report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể bắt đầu xử lý khi yêu cầu đang ở trạng thái Chờ xử lý (PENDING).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);

        Manager manager = null;
        if (principal != null && StringUtils.hasText(principal.email())) {
            manager = findManagerByEmail(principal.email());
        }

        if (request != null && StringUtils.hasText(request.managerId())) {
            report.setManagerId(request.managerId().trim());
        } else if (!StringUtils.hasText(report.getManagerId()) && principal != null) {
            if (manager != null) {
                report.setManagerId(manager.getId());
            } else {
                report.setManagerId(principal.userId());
            }
        }

        String defaultAssigneeName = manager != null && StringUtils.hasText(manager.getFullName())
                ? manager.getFullName()
                : resolveActorName(principal, "Quản lý");
        String defaultAssigneePhone = manager != null && StringUtils.hasText(manager.getPhone())
                ? manager.getPhone()
                : (principal != null ? principal.phone() : null);

        String assigneeName = (request != null && StringUtils.hasText(request.assigneeName()))
                ? request.assigneeName().trim()
                : (StringUtils.hasText(report.getAssigneeName()) ? report.getAssigneeName() : defaultAssigneeName);
        String assigneePhone = (request != null && request.assigneePhone() != null)
                ? request.assigneePhone().trim()
                : (StringUtils.hasText(report.getAssigneePhone()) ? report.getAssigneePhone() : defaultAssigneePhone);

        report.setAssigneeName(assigneeName);
        report.setAssigneePhone(StringUtils.hasText(assigneePhone) ? assigneePhone : null);
        reportRequestRepository.save(report);

        String assigneeDisplay = StringUtils.hasText(report.getAssigneePhone())
                ? report.getAssigneeName() + " (" + report.getAssigneePhone() + ")"
                : report.getAssigneeName();

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.STATUS_CHANGED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                "Tiếp nhận và bắt đầu xử lý yêu cầu · Người phụ trách: " + assigneeDisplay,
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse assign(String id, ReportRequestAssignRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() == ReportRequestStatus.CLOSED ||
                report.getStatus() == ReportRequestStatus.REJECTED ||
                report.getStatus() == ReportRequestStatus.CANCELLED) {
            throw new BadRequestException("Yêu cầu đã kết thúc, không thể thay đổi người phụ trách.");
        }

        String assigneeName = (request != null && StringUtils.hasText(request.assigneeName()))
                ? request.assigneeName().trim()
                : resolveActorName(principal, "Quản lý");
        String assigneePhone = (request != null && StringUtils.hasText(request.assigneePhone()))
                ? request.assigneePhone().trim()
                : null;

        if (request != null && StringUtils.hasText(request.managerId())) {
            report.setManagerId(request.managerId().trim());
        } else if (!StringUtils.hasText(report.getManagerId()) && principal != null) {
            Manager manager = findManagerByEmail(principal.email());
            report.setManagerId(manager != null ? manager.getId() : principal.userId());
        }

        report.setAssigneeName(assigneeName);
        report.setAssigneePhone(assigneePhone);
        reportRequestRepository.save(report);

        String assigneeDisplay = StringUtils.hasText(assigneePhone)
                ? assigneeName + " (" + assigneePhone + ")"
                : assigneeName;

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.ASSIGNED,
                report.getStatus(),
                report.getStatus(),
                "Phân công người phụ trách xử lý: " + assigneeDisplay,
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse requestInfo(String id, ReportRequestInfoRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING && report.getStatus() != ReportRequestStatus.IN_PROGRESS) {
            throw new BadRequestException("Chỉ có thể yêu cầu bổ sung thông tin khi yêu cầu ở trạng thái Chờ xử lý (PENDING) hoặc Đang xử lý (IN_PROGRESS).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.WAITING_INFO);
        report.setRequestedInfoNote(request.note().trim());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.REQUESTED_INFO,
                previousStatus,
                ReportRequestStatus.WAITING_INFO,
                request.note().trim(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse supplementInfo(String id, ReportRequestSupplementRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể bổ sung thông tin khi yêu cầu đang ở trạng thái Chờ bổ sung (WAITING_INFO).");
        }

        validateAttachments(request.additionalAttachments());

        // Bổ sung nội dung và tệp đính kèm
        if (StringUtils.hasText(request.additionalInfo())) {
            report.setContent(report.getContent() + "\n\n[Bổ sung ngày " + Instant.now() + "]: " + request.additionalInfo().trim());
        }
        if (request.additionalAttachments() != null && !request.additionalAttachments().isEmpty()) {
            List<String> current = new ArrayList<>(report.getAttachments());
            current.addAll(request.additionalAttachments());
            report.setAttachments(current);
        }

        // Sau khi bổ sung, đưa trạng thái quay lại PENDING để Manager tiếp nhận
        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.PENDING);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                "TENANT",
                resolveActorName(principal, "Khách thuê"),
                report.getManagerId(),
                ReportRecordAction.INFO_SUPPLEMENTED,
                previousStatus,
                ReportRequestStatus.PENDING,
                request.additionalInfo().trim(),
                request.additionalAttachments() != null ? request.additionalAttachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse reject(String id, ReportRequestRejectRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING &&
                report.getStatus() != ReportRequestStatus.IN_PROGRESS &&
                report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể từ chối yêu cầu khi đang ở trạng thái Chờ xử lý, Đang xử lý hoặc Chờ bổ sung.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.REJECTED);
        report.setRejectReason(request.reason().trim());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.REJECTED,
                previousStatus,
                ReportRequestStatus.REJECTED,
                request.reason().trim(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse updateProgress(String id, ReportRequestProgressRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.IN_PROGRESS && report.getStatus() != ReportRequestStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể cập nhật tiến độ khi yêu cầu đang ở trạng thái Đang xử lý (IN_PROGRESS) hoặc Chờ xử lý (PENDING).");
        }

        validateAttachments(request.attachments());

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.PROGRESS_UPDATED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                request.progressNote().trim(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse resolve(String id, ReportRequestResolveRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.IN_PROGRESS && report.getStatus() != ReportRequestStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể báo kết quả giải quyết khi yêu cầu đang ở trạng thái Đang xử lý (IN_PROGRESS) hoặc Chờ xử lý (PENDING).");
        }

        validateAttachments(request.attachments());

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.RESOLVED);
        report.setSolutionResult(request.solutionResult().trim());
        report.setResolvedAt(Instant.now());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.RESOLVED,
                previousStatus,
                ReportRequestStatus.RESOLVED,
                request.solutionResult().trim(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse confirmClose(String id, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.RESOLVED) {
            throw new BadRequestException("Chỉ có thể xác nhận đóng khi yêu cầu đã được xử lý (RESOLVED).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.CLOSED);
        report.setClosedAt(Instant.now());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                "TENANT",
                resolveActorName(principal, "Khách thuê"),
                report.getManagerId(),
                ReportRecordAction.CLOSED,
                previousStatus,
                ReportRequestStatus.CLOSED,
                "Khách thuê hài lòng và xác nhận đóng yêu cầu",
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse reopen(String id, ReportRequestReopenRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.RESOLVED) {
            throw new BadRequestException("Chỉ có thể mở lại yêu cầu khi đang ở trạng thái đã giải quyết (RESOLVED).");
        }

        validateAttachments(request.attachments());

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "TENANT",
                resolveActorName(principal, "Khách thuê"),
                report.getManagerId(),
                ReportRecordAction.REOPENED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                "Khách thuê chưa hài lòng và yêu cầu mở lại xử lý: " + request.reason().trim(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }


    @Override
    @Transactional
    public ReportRequestResponse cancel(String id, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING && report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể hủy yêu cầu khi đang ở trạng thái Chờ tiếp nhận hoặc Chờ bổ sung.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.CANCELLED);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                "TENANT",
                resolveActorName(principal, "Khách thuê"),
                report.getManagerId(),
                ReportRecordAction.CANCELLED,
                previousStatus,
                ReportRequestStatus.CANCELLED,
                "Khách thuê chủ động hủy yêu cầu",
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse update(String id, ReportRequestUpdateRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() == ReportRequestStatus.CLOSED ||
                report.getStatus() == ReportRequestStatus.REJECTED ||
                report.getStatus() == ReportRequestStatus.CANCELLED) {
            throw new BadRequestException("Yêu cầu đã kết thúc, không thể chỉnh sửa.");
        }

        if (request.type() != null) report.setType(request.type());
        if (StringUtils.hasText(request.title())) report.setTitle(request.title().trim());
        if (StringUtils.hasText(request.content())) report.setContent(request.content().trim());
        if (request.attachments() != null) {
            validateAttachments(request.attachments());
            report.setAttachments(request.attachments());
        }
        if (request.priority() != null) report.setPriority(request.priority());
        if (request.rejectReason() != null) report.setRejectReason(request.rejectReason().trim());

        ReportRequest updated = reportRequestRepository.save(report);
        return getById(updated.getId(), principal);
    }

    @Override
    @Transactional
    public void delete(String id, AuthPrincipal principal) {
        requireRole(principal, "ADMIN", "OWNER", "MANAGER");
        ReportRequest report = findReport(id);
        report.markDeleted();
        reportRequestRepository.save(report);
    }

    // ================= HELPER METHODS =================

    private ReportRequestResponse buildResponse(ReportRequest r, List<ReportRecordResponse> timeline) {
        String roomName = null;
        String slotName = null;
        try {
            if (StringUtils.hasText(r.getRoomId())) {
                Room room = roomRepository.findByIdAndIsDeletedFalse(r.getRoomId()).orElse(null);
                if (room != null && StringUtils.hasText(room.getRoomNumber())) {
                    String rn = room.getRoomNumber().trim();
                    roomName = (rn.startsWith("P.") || rn.startsWith("Phòng")) ? rn : ("P." + rn);
                }
            }
            Contract contract = null;
            if (StringUtils.hasText(r.getContractId())) {
                contract = contractRepository.findByIdAndIsDeletedFalse(r.getContractId()).orElse(null);
            }
            if (contract == null && StringUtils.hasText(r.getTenantId())) {
                contract = findActiveContract(r.getTenantId(), r.getRoomId());
            }
            if (contract != null) {
                List<String> slotIds = new ArrayList<>();
                if (StringUtils.hasText(contract.getRoomSlotId())) {
                    slotIds.add(contract.getRoomSlotId());
                } else if (contract.getRoomSlotIds() != null && !contract.getRoomSlotIds().isEmpty()) {
                    slotIds.add(contract.getRoomSlotIds().get(0));
                }
                if (!slotIds.isEmpty()) {
                    List<String> codes = new ArrayList<>();
                    for (String sid : slotIds) {
                        RoomSlot slot = roomSlotRepository.findByIdAndIsDeletedFalse(sid).orElse(null);
                        if (slot != null && StringUtils.hasText(slot.getSlotCode())) {
                            String rawCode = slot.getSlotCode().trim();
                            codes.add(rawCode.contains("-") ? rawCode.substring(rawCode.lastIndexOf('-') + 1).trim() : rawCode);
                        }
                    }
                    if (!codes.isEmpty()) {
                        slotName = String.join(", ", codes);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        String assigneeName = r.getAssigneeName();
        String assigneePhone = r.getAssigneePhone();
        if (!StringUtils.hasText(assigneeName) && StringUtils.hasText(r.getManagerId())) {
            try {
                Manager m = managerRepository.findByIdAndIsDeletedFalse(r.getManagerId()).orElse(null);
                if (m != null && StringUtils.hasText(m.getFullName())) {
                    assigneeName = m.getFullName();
                    if (!StringUtils.hasText(assigneePhone) && StringUtils.hasText(m.getPhone())) {
                        assigneePhone = m.getPhone();
                    }
                } else {
                    User u = userRepository.findByIdAndIsDeletedFalse(r.getManagerId()).orElse(null);
                    if (u != null && StringUtils.hasText(u.getFullName())) {
                        assigneeName = u.getFullName();
                        if (!StringUtils.hasText(assigneePhone) && StringUtils.hasText(u.getPhone())) {
                            assigneePhone = u.getPhone();
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        String tenantName = resolveTenantName(r.getTenantId());
        return ReportRequestResponse.from(r, timeline, roomName, slotName, assigneeName, assigneePhone, tenantName);
    }

    private ReportRequest findReport(String id) {
        return reportRequestRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu hỗ trợ với id: " + id));
    }

    private void validateAttachments(List<String> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return;
        }
        if (attachments.size() > MAX_ATTACHMENTS) {
            throw new BadRequestException("Chỉ được gửi tối đa " + MAX_ATTACHMENTS + " ảnh cho mỗi lần gửi.");
        }
        for (String att : attachments) {
            if (!StringUtils.hasText(att)) {
                continue;
            }
            if (att.startsWith("data:image/")) {
                int commaIdx = att.indexOf(',');
                if (commaIdx == -1) {
                    throw new BadRequestException("Dữ liệu ảnh base64 không đúng định dạng.");
                }
                String header = att.substring(0, commaIdx);
                if (!header.contains("image/jpeg") && !header.contains("image/png") &&
                        !header.contains("image/webp") && !header.contains("image/jpg")) {
                    throw new BadRequestException("Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
                }
                String base64Content = att.substring(commaIdx + 1);
                long estimatedBytes = (long) (base64Content.length() * 0.75);
                if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
                    throw new BadRequestException("Ảnh vượt quá dung lượng cho phép (tối đa 5 MB mỗi ảnh).");
                }
            } else {
                if (att.length() > 2048) {
                    throw new BadRequestException("Đường dẫn ảnh quá dài.");
                }
            }
        }
    }

    private String resolveActorName(AuthPrincipal principal, String defaultName) {
        if (principal == null) return defaultName;
        if (StringUtils.hasText(principal.fullName())) return principal.fullName();
        if (StringUtils.hasText(principal.getUsername())) return principal.getUsername();
        return defaultName;
    }

    private void createRecord(String reportRequestId, String actorId, String actorRole, String actorName,
                              String managerId, ReportRecordAction action, ReportRequestStatus statusFrom,
                              ReportRequestStatus statusTo, String note, List<String> attachments) {
        ReportRecord record = new ReportRecord();
        record.setReportRequestId(reportRequestId);
        record.setActorId(actorId);
        record.setActorRole(actorRole);
        record.setActorName(actorName);
        record.setManagerId(managerId);
        record.setAction(action);
        record.setStatusFrom(statusFrom);
        record.setStatusTo(statusTo);
        record.setNote(note);
        if (attachments != null) {
            record.setAttachments(attachments);
        }
        reportRecordRepository.save(record);
    }

    private Tenant resolveTenant(AuthPrincipal principal, String inputTenantId) {
        if (principal != null && "TENANT".equals(principal.role())) {
            List<Tenant> existing = findTenantsByEmail(principal.email());
            if (!existing.isEmpty()) {
                return existing.get(0);
            }
            User user = findUserByEmail(principal.email());
            Tenant newTenant = new Tenant();
            newTenant.setEmail(principal.email());
            newTenant.setFullName(user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName() : principal.fullName());
            newTenant.setPhone(user != null ? user.getPhone() : principal.phone());
            if (user != null) {
                newTenant.setIdCardNumber(user.getCccdNumber());
                newTenant.setAddress(user.getPermanentAddress());
                if (StringUtils.hasText(user.getDateOfBirth())) {
                    try {
                        newTenant.setDateOfBirth(java.time.LocalDate.parse(user.getDateOfBirth().strip()));
                    } catch (Exception ignored) {
                    }
                }
            }
            return tenantRepository.save(newTenant);
        }
        if (StringUtils.hasText(inputTenantId)) {
            try {
                Tenant found = tenantRepository.findByIdAndIsDeletedFalse(inputTenantId).orElse(null);
                if (found != null) return found;
            } catch (Exception ignored) {
            }
        }
        if (principal == null || principal.email() == null) {
            throw new ForbiddenException("Không xác định được danh tính khách thuê hiện tại.");
        }
        List<Tenant> existing = findTenantsByEmail(principal.email());
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        User user = findUserByEmail(principal.email());
        Tenant newTenant = new Tenant();
        newTenant.setEmail(principal.email());
        newTenant.setFullName(user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName() : principal.fullName());
        newTenant.setPhone(user != null ? user.getPhone() : principal.phone());
        if (user != null) {
            newTenant.setIdCardNumber(user.getCccdNumber());
            newTenant.setAddress(user.getPermanentAddress());
            if (StringUtils.hasText(user.getDateOfBirth())) {
                try {
                    newTenant.setDateOfBirth(java.time.LocalDate.parse(user.getDateOfBirth().strip()));
                } catch (Exception ignored) {
                }
            }
        }
        return tenantRepository.save(newTenant);
    }

    private Contract findActiveContract(String tenantId, String roomId) {
        try {
            if (!StringUtils.hasText(tenantId)) {
                return null;
            }

            List<Criteria> ownership = new ArrayList<>();
            if (org.bson.types.ObjectId.isValid(tenantId)) {
                ownership.add(Criteria.where("tenantId").is(new org.bson.types.ObjectId(tenantId)));
            }
            ownership.add(Criteria.where("tenantId").is(tenantId));

            List<ContractTenant> activeMemberships = contractTenantRepository.findByTenantIdAndIsDeletedFalse(tenantId)
                    .stream()
                    .filter(ct -> ct.getStatus() == ContractTenantStatus.ACTIVE)
                    .toList();
            List<org.bson.types.ObjectId> memberContractIds = activeMemberships.stream()
                    .map(ContractTenant::getContractId)
                    .filter(StringUtils::hasText)
                    .filter(org.bson.types.ObjectId::isValid)
                    .map(org.bson.types.ObjectId::new)
                    .toList();
            if (!memberContractIds.isEmpty()) {
                ownership.add(Criteria.where("_id").in(memberContractIds));
            }

            List<Criteria> contractCriteria = new ArrayList<>();
            contractCriteria.add(Criteria.where("isDeleted").is(false));
            contractCriteria.add(Criteria.where("status").in(List.of(ContractStatus.ACTIVE.name(), "ACTIVE", "SIGNED")));
            contractCriteria.add(new Criteria().orOperator(ownership.toArray(new Criteria[0])));

            if (StringUtils.hasText(roomId) && org.bson.types.ObjectId.isValid(roomId)) {
                List<Criteria> withRoom = new ArrayList<>(contractCriteria);
                withRoom.add(new Criteria().orOperator(
                        Criteria.where("roomId").is(new org.bson.types.ObjectId(roomId)),
                        Criteria.where("roomId").is(roomId)
                ));
                Contract byRoom = mongoTemplate.findOne(
                        new Query(new Criteria().andOperator(withRoom.toArray(new Criteria[0]))),
                        Contract.class
                );
                if (byRoom != null) {
                    return byRoom;
                }
            }

            // Nếu roomId từ FE là UUID mock nhưng khách thuê có hợp đồng ACTIVE thật trong DB thì lấy hợp đồng của chính khách thuê đó
            return mongoTemplate.findOne(
                    new Query(new Criteria().andOperator(contractCriteria.toArray(new Criteria[0]))),
                    Contract.class
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private String resolveManager(Room room, Contract contract) {
        try {
            if (contract != null && StringUtils.hasText(contract.getManagerId())) {
                return contract.getManagerId();
            }
            if (room != null && StringUtils.hasText(room.getBranchId()) && org.bson.types.ObjectId.isValid(room.getBranchId())) {
                Query q = new Query(Criteria.where("branchId").is(new org.bson.types.ObjectId(room.getBranchId()))
                        .and("status").is(ManagerStatus.ACTIVE.name())
                        .and("isDeleted").is(false));
                Manager m = mongoTemplate.findOne(q, Manager.class);
                if (m != null) {
                    return m.getId();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void ensureTenantOwnsOrAdmin(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role()) || "MANAGER".equals(principal.role()) || "OWNER".equals(principal.role())) return;
        Set<String> actorIds = collectTenantActorIds(principal);
        if (StringUtils.hasText(report.getTenantId()) && !actorIds.contains(report.getTenantId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên yêu cầu này.");
        }
    }

    private Set<String> collectTenantActorIds(AuthPrincipal principal) {
        Set<String> ids = new LinkedHashSet<>();
        if (principal == null) return ids;
        if (StringUtils.hasText(principal.userId())) {
            ids.add(principal.userId());
        }
        for (Tenant t : findTenantsByEmail(principal.email())) {
            if (t != null && StringUtils.hasText(t.getId())) {
                ids.add(t.getId());
            }
        }
        return ids;
    }

    private List<Tenant> findTenantsByEmail(String email) {
        if (!StringUtils.hasText(email)) return List.of();
        List<Tenant> results = new ArrayList<>();
        tenantRepository.findByEmailAndIsDeletedFalse(email).ifPresent(results::add);
        try {
            List<Tenant> ci = mongoTemplate.find(
                    Query.query(Criteria.where("isDeleted").is(false)
                            .and("email").regex("^" + Pattern.quote(email.trim()) + "$", "i")),
                    Tenant.class
            );
            if (ci != null) {
                for (Tenant t : ci) {
                    if (t != null && results.stream().noneMatch(e -> t.getId() != null && t.getId().equals(e.getId()))) {
                        results.add(t);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return results;
    }

    private Manager findManagerByEmail(String email) {
        if (!StringUtils.hasText(email)) return null;
        Manager direct = managerRepository.findByEmailAndIsDeletedFalse(email).orElse(null);
        if (direct != null) return direct;
        try {
            return mongoTemplate.findOne(
                    Query.query(Criteria.where("isDeleted").is(false)
                            .and("email").regex("^" + Pattern.quote(email.trim()) + "$", "i")),
                    Manager.class
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private User findUserByEmail(String email) {
        if (!StringUtils.hasText(email)) return null;
        User direct = userRepository.findByEmailAndIsDeletedFalse(email).orElse(null);
        if (direct != null) return direct;
        try {
            return mongoTemplate.findOne(
                    Query.query(Criteria.where("isDeleted").is(false)
                            .and("email").regex("^" + Pattern.quote(email.trim()) + "$", "i")),
                    User.class
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> findOwnerBranchIds(String ownerAccountId) {
        if (!StringUtils.hasText(ownerAccountId)) return List.of();
        try {
            List<Branch> branches = mongoTemplate.find(
                    Query.query(Criteria.where("isDeleted").is(false)
                            .and("ownerAccountId").in(toIdValues(Set.of(ownerAccountId)))),
                    Branch.class
            );
            if (branches == null) return List.of();
            return branches.stream().map(Branch::getId).filter(StringUtils::hasText).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private void addBranchFilter(List<Criteria> target, List<String> branchIds) {
        if (branchIds == null || branchIds.isEmpty()) return;
        List<Criteria> branchMatch = new ArrayList<>();
        branchMatch.add(Criteria.where("branchId").in(toIdValues(branchIds)));
        try {
            List<Room> rooms = branchIds.size() == 1
                    ? roomRepository.findByBranchIdAndIsDeletedFalse(branchIds.get(0))
                    : roomRepository.findByBranchIdInAndIsDeletedFalse(branchIds);
            if (rooms != null && !rooms.isEmpty()) {
                List<String> roomIds = rooms.stream().map(Room::getId).filter(StringUtils::hasText).toList();
                if (!roomIds.isEmpty()) {
                    branchMatch.add(Criteria.where("roomId").in(toIdValues(roomIds)));
                }
            }
        } catch (Exception ignored) {
        }
        target.add(branchMatch.size() == 1
                ? branchMatch.get(0)
                : new Criteria().orOperator(branchMatch.toArray(new Criteria[0])));
    }

    private List<Object> toIdValues(Collection<String> ids) {
        List<Object> values = new ArrayList<>();
        for (String id : ids) {
            if (!StringUtils.hasText(id)) continue;
            values.add(id);
            if (org.bson.types.ObjectId.isValid(id)) {
                values.add(new org.bson.types.ObjectId(id));
            }
        }
        return values;
    }

    private String resolveTenantName(String tenantId) {
        if (!StringUtils.hasText(tenantId)) return null;
        try {
            Tenant t = tenantRepository.findByIdAndIsDeletedFalse(tenantId).orElse(null);
            if (t != null && StringUtils.hasText(t.getFullName())) {
                return t.getFullName();
            }
            User u = userRepository.findByIdAndIsDeletedFalse(tenantId).orElse(null);
            if (u != null && StringUtils.hasText(u.getFullName())) {
                return u.getFullName();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void ensureCanView(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role()) || "MANAGER".equals(principal.role()) || "OWNER".equals(principal.role())) {
            return;
        }
        if ("TENANT".equals(principal.role())) {
            ensureTenantOwnsOrAdmin(report, principal);
        }
    }

    private void ensureCanManage(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role()) || "OWNER".equals(principal.role()) || "MANAGER".equals(principal.role())) {
            return;
        }
        throw new ForbiddenException("Vai trò hiện tại (" + principal.role() + ") không được phép thực hiện thao tác quản lý yêu cầu này.");
    }

    private void requireRole(AuthPrincipal principal, String... roles) {
        if (principal == null) return;
        for (String r : roles) {
            if (r.equals(principal.role())) return;
        }
        throw new ForbiddenException("Vai trò hiện tại (" + principal.role() + ") không được phép thực hiện thao tác này.");
    }
    @Override
    public List<OverviewReport> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("roomId", ids);
        query.fields().include("roomId", "status", "title", "tenantId");
        return mongoTemplate.find(query, ReportRequest.class).stream()
                .map(item -> new OverviewReport(item.getRoomId(), item.getStatus(), item.getId(), item.getTitle(), item.getTenantId())).toList();
    }
}
