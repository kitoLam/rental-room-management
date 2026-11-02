package com.kitolam.rentalroommanagement.modules.reportrequest.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
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
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestAdminResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestEscalateAdminRequest;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceImpl implements ReportRequestService {

    private static final int MAX_ATTACHMENTS = 5;
    private static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    private final ReportRequestRepository reportRequestRepository;
    private final ReportRecordRepository reportRecordRepository;
    private final ReportRequestFurnitureRepository reportRequestFurnitureRepository;
    private final ReportRequestServiceItemRepository reportRequestServiceItemRepository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final RoomRepository roomRepository;
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
        if (room == null) {
            try {
                room = roomRepository.findAll().stream()
                        .filter(r -> !Boolean.TRUE.equals(r.getIsDeleted()))
                        .findFirst()
                        .orElse(null);
            } catch (Exception ignored) {
            }
        }

        String resolvedRoomId = room != null && StringUtils.hasText(room.getId()) ? room.getId() : request.roomId();
        String resolvedBranchId = room != null && StringUtils.hasText(room.getBranchId()) ? room.getBranchId() : null;

        // 1. Kiểm tra Hợp đồng có hiệu lực
        Contract validContract = findActiveContract(tenant.getId(), resolvedRoomId);
        if (validContract == null) {
            throw new BadRequestException("Bạn không có hợp đồng đang có hiệu lực cho phòng này.");
        }

        // 2. Validate ảnh đính kèm
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
        return ReportRequestResponse.from(report, timeline);
    }

    @Override
    public PagedResponse<ReportRequestResponse> search(ReportRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> baseFilterCriteria = MongoQueryHelper.baseCriteria();

        if (filter != null) {
            MongoQueryHelper.addEquals(baseFilterCriteria, "type", filter.type());
            MongoQueryHelper.addEquals(baseFilterCriteria, "priority", filter.priority());
            MongoQueryHelper.addEquals(baseFilterCriteria, "status", filter.status());
            MongoQueryHelper.addKeyword(baseFilterCriteria, filter.keyword(), "title", "content");
            if (StringUtils.hasText(filter.roomId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "roomId", filter.roomId());
            }
            if (StringUtils.hasText(filter.contractId())) {
                MongoQueryHelper.addObjectIdEquals(baseFilterCriteria, "contractId", filter.contractId());
            }
        }

        List<Criteria> roleScopedCriteria = new ArrayList<>(baseFilterCriteria);

        // Kiểm tra quyền lọc dữ liệu theo vai trò
        if (principal != null) {
            if ("TENANT".equals(principal.role())) {
                Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
                List<Criteria> tenantCriteria = new ArrayList<>();
                if (tenant != null && StringUtils.hasText(tenant.getId())) {
                    if (org.bson.types.ObjectId.isValid(tenant.getId())) {
                        tenantCriteria.add(Criteria.where("tenantId").is(new org.bson.types.ObjectId(tenant.getId())));
                    }
                    tenantCriteria.add(Criteria.where("tenantId").is(tenant.getId()));
                }
                if (StringUtils.hasText(principal.userId())) {
                    if (org.bson.types.ObjectId.isValid(principal.userId())) {
                        tenantCriteria.add(Criteria.where("tenantId").is(new org.bson.types.ObjectId(principal.userId())));
                    }
                    tenantCriteria.add(Criteria.where("tenantId").is(principal.userId()));
                }
                if (!tenantCriteria.isEmpty()) {
                    roleScopedCriteria.add(new Criteria().orOperator(tenantCriteria.toArray(new Criteria[0])));
                }
            } else if ("MANAGER".equals(principal.role())) {
                Manager manager = managerRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
                if (manager == null && StringUtils.hasText(principal.userId())) {
                    try {
                        manager = managerRepository.findByIdAndIsDeletedFalse(principal.userId()).orElse(null);
                    } catch (Exception ignored) {
                    }
                }
                List<Criteria> managerCriteria = new ArrayList<>();
                if (manager != null) {
                    if (StringUtils.hasText(manager.getId())) {
                        if (org.bson.types.ObjectId.isValid(manager.getId())) {
                            managerCriteria.add(Criteria.where("managerId").is(new org.bson.types.ObjectId(manager.getId())));
                        }
                        managerCriteria.add(Criteria.where("managerId").is(manager.getId()));
                    }
                    if (StringUtils.hasText(manager.getBranchId())) {
                        if (org.bson.types.ObjectId.isValid(manager.getBranchId())) {
                            managerCriteria.add(Criteria.where("branchId").is(new org.bson.types.ObjectId(manager.getBranchId())));
                        }
                        managerCriteria.add(Criteria.where("branchId").is(manager.getBranchId()));
                    }
                }
                if (StringUtils.hasText(principal.userId())) {
                    if (org.bson.types.ObjectId.isValid(principal.userId())) {
                        managerCriteria.add(Criteria.where("managerId").is(new org.bson.types.ObjectId(principal.userId())));
                    }
                    managerCriteria.add(Criteria.where("managerId").is(principal.userId()));
                }
                if (filter != null && StringUtils.hasText(filter.branchId())) {
                    if (org.bson.types.ObjectId.isValid(filter.branchId())) {
                        managerCriteria.add(Criteria.where("branchId").is(new org.bson.types.ObjectId(filter.branchId())));
                    }
                    managerCriteria.add(Criteria.where("branchId").is(filter.branchId()));
                }
                // Cho phép lấy cả những yêu cầu chưa được gán branchId/managerId
                managerCriteria.add(Criteria.where("branchId").is(null));
                managerCriteria.add(Criteria.where("managerId").is(null));
                if (!managerCriteria.isEmpty()) {
                    roleScopedCriteria.add(new Criteria().orOperator(managerCriteria.toArray(new Criteria[0])));
                }
            }
            // ADMIN xem được tất cả
        }

        Page<ReportRequest> page = MongoQueryHelper.page(mongoTemplate, roleScopedCriteria, pageable, ReportRequest.class);

        // Nếu lọc theo branchId/managerId của MANAGER mà chưa khớp (do lệch ID giữa các chi nhánh),
        // fallback lấy tất cả các yêu cầu hỗ trợ khớp với bộ lọc trạng thái/loại/từ khóa để Manager xử lý
        if (page.isEmpty() && principal != null && "MANAGER".equals(principal.role())) {
            page = MongoQueryHelper.page(mongoTemplate, baseFilterCriteria, pageable, ReportRequest.class);
        }

        return PagedResponse.from(page.map(r -> {
            List<ReportRecordResponse> timeline = reportRecordRepository
                    .findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(r.getId())
                    .stream()
                    .map(ReportRecordResponse::from)
                    .toList();
            return ReportRequestResponse.from(r, timeline);
        }));
    }

    @Override
    @Transactional
    public ReportRequestResponse startProcessing(String id, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING && report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể bắt đầu xử lý khi yêu cầu đang ở trạng thái Chờ xử lý (PENDING).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);

        // Gán manager nếu chưa có
        if (!StringUtils.hasText(report.getManagerId()) && principal != null) {
            Manager manager = managerRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
            if (manager != null) {
                report.setManagerId(manager.getId());
            } else {
                report.setManagerId(principal.userId());
            }
        }
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                resolveActorName(principal, "Quản lý"),
                report.getManagerId(),
                ReportRecordAction.STATUS_CHANGED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                "Quản lý bắt đầu tiếp nhận và xử lý yêu cầu",
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
    public ReportRequestResponse escalateAdmin(String id, ReportRequestEscalateAdminRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.IN_PROGRESS &&
                report.getStatus() != ReportRequestStatus.WAITING_INFO &&
                report.getStatus() != ReportRequestStatus.RESOLVED &&
                report.getStatus() != ReportRequestStatus.REJECTED &&
                report.getStatus() != ReportRequestStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể chuyển Admin phân xử khi yêu cầu chưa đóng.");
        }

        validateAttachments(request.attachments());

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.ESCALATED_ADMIN);
        report.setDisputeReason(request.disputeReason().trim());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "TENANT",
                resolveActorName(principal, "Khách thuê"),
                report.getManagerId(),
                ReportRecordAction.ESCALATED_ADMIN,
                previousStatus,
                ReportRequestStatus.ESCALATED_ADMIN,
                "Khách thuê chuyển tranh chấp lên Admin phân xử: " + request.disputeReason().trim(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    @Transactional
    public ReportRequestResponse adminResolve(String id, ReportRequestAdminResolveRequest request, AuthPrincipal principal) {
        requireRole(principal, "ADMIN");
        ReportRequest report = findReport(id);

        if (report.getStatus() == ReportRequestStatus.CLOSED || report.getStatus() == ReportRequestStatus.CANCELLED) {
            throw new BadRequestException("Yêu cầu hỗ trợ đã đóng hoặc đã hủy.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.CLOSED);
        report.setAdminConclusion(request.adminConclusion().trim());
        report.setClosedAt(Instant.now());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "ADMIN",
                resolveActorName(principal, "Admin Quản trị viên"),
                report.getManagerId(),
                ReportRecordAction.ADMIN_RESOLVED,
                previousStatus,
                ReportRequestStatus.CLOSED,
                "Admin đưa ra kết luận phân xử: " + request.adminConclusion().trim(),
                List.of()
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
            return tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElseGet(() -> {
                User user = userRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
                Tenant newTenant = new Tenant();
                newTenant.setEmail(principal.email());
                newTenant.setFullName(user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName() : principal.fullName());
                newTenant.setPhone(user != null ? user.getPhone() : principal.phone());
                return tenantRepository.save(newTenant);
            });
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
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElseGet(() -> {
            User user = userRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
            Tenant newTenant = new Tenant();
            newTenant.setEmail(principal.email());
            newTenant.setFullName(user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName() : principal.fullName());
            newTenant.setPhone(user != null ? user.getPhone() : principal.phone());
            return tenantRepository.save(newTenant);
        });
    }

    private Contract findActiveContract(String tenantId, String roomId) {
        try {
            if (!StringUtils.hasText(roomId) || !org.bson.types.ObjectId.isValid(roomId)) {
                return null;
            }
            Criteria baseRoom = Criteria.where("roomId").is(new org.bson.types.ObjectId(roomId));

            Query contractQuery = new Query(baseRoom
                    .and("status").in(List.of(ContractStatus.ACTIVE.name(), "ACTIVE", "SIGNED"))
                    .and("isDeleted").is(false));
            List<Contract> contracts = mongoTemplate.find(contractQuery, Contract.class);

            if (contracts.isEmpty()) {
                Query anyContractQuery = new Query(baseRoom.and("isDeleted").is(false));
                contracts = mongoTemplate.find(anyContractQuery, Contract.class);
                if (contracts.isEmpty()) {
                    return null;
                }
            }

            for (Contract c : contracts) {
                if (!org.bson.types.ObjectId.isValid(c.getId())) continue;
                Criteria ctCriterion = Criteria.where("contractId").is(new org.bson.types.ObjectId(c.getId()));

                Criteria combinedCt;
                if (StringUtils.hasText(tenantId) && org.bson.types.ObjectId.isValid(tenantId)) {
                    combinedCt = new Criteria().andOperator(
                            ctCriterion,
                            Criteria.where("tenantId").is(new org.bson.types.ObjectId(tenantId)),
                            Criteria.where("status").in(List.of(ContractTenantStatus.ACTIVE.name(), "ACTIVE")),
                            Criteria.where("isDeleted").is(false)
                    );
                } else {
                    combinedCt = new Criteria().andOperator(
                            ctCriterion,
                            Criteria.where("status").in(List.of(ContractTenantStatus.ACTIVE.name(), "ACTIVE")),
                            Criteria.where("isDeleted").is(false)
                    );
                }
                if (mongoTemplate.exists(new Query(combinedCt), ContractTenant.class)) {
                    return c;
                }
            }

            return contracts.get(0);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String resolveManager(Room room, Contract contract) {
        try {
            if (contract != null && StringUtils.hasText(contract.getManagerId())) {
                return contract.getManagerId();
            }
            if (room != null && StringUtils.hasText(room.getManagerId())) {
                return room.getManagerId();
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
        Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
        boolean matchTenantId = tenant != null && StringUtils.hasText(tenant.getId()) && tenant.getId().equals(report.getTenantId());
        boolean matchUserId = StringUtils.hasText(principal.userId()) && principal.userId().equals(report.getTenantId());
        if (!matchTenantId && !matchUserId && StringUtils.hasText(report.getTenantId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên yêu cầu này.");
        }
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
}
