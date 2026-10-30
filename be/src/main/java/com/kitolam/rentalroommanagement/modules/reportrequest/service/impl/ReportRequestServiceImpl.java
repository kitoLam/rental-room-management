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
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportRequestServiceImpl implements ReportRequestService {

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
    public ReportRequestResponse create(ReportRequestCreateRequest request, AuthPrincipal principal) {
        Tenant tenant = resolveTenant(principal, request.tenantId());
        Room room = roomRepository.findByIdAndIsDeletedFalse(request.roomId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thông tin phòng: " + request.roomId()));

        // 1. Kiểm tra Hợp đồng có hiệu lực không
        Contract validContract = findActiveContract(tenant.getId(), room.getId());
        if (validContract == null) {
            throw new BadRequestException("Không thể gửi yêu cầu: Khách thuê không có hợp đồng đang có hiệu lực tại phòng này.");
        }

        // 2. Tự động gán Manager theo khu trọ
        String assignedManagerId = resolveManager(room, validContract);

        // 3. Ghi nhận yêu cầu (Mới)
        ReportRequest entity = new ReportRequest();
        entity.setTenantId(tenant.getId());
        entity.setRoomId(room.getId());
        entity.setBranchId(room.getBranchId());
        entity.setContractId(validContract.getId());
        entity.setManagerId(assignedManagerId);
        entity.setType(request.type());
        entity.setTitle(request.title());
        entity.setContent(request.content());
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
                    rrf.setIssueDescription(request.title());
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
                    rrs.setNote(request.title());
                    reportRequestServiceItemRepository.save(rrs);
                }
            }
        }

        // 4. Lưu lịch sử ReportRecord khởi tạo
        createRecord(
                saved.getId(),
                tenant.getId(),
                "TENANT",
                tenant.getFullName(),
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
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();

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
                    criteria.add(new Criteria().orOperator(tenantCriteria.toArray(new Criteria[0])));
                }
            } else if ("MANAGER".equals(principal.role())) {
                Manager manager = managerRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
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
                if (!managerCriteria.isEmpty()) {
                    criteria.add(new Criteria().orOperator(managerCriteria.toArray(new Criteria[0])));
                }
            }
            // ADMIN xem được tất cả
        }

        if (filter != null) {
            if (filter.tenantId() != null && (principal == null || !"TENANT".equals(principal.role()))) {
                MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
            }
            MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
            if (principal == null || !"MANAGER".equals(principal.role())) {
                MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
            }
            MongoQueryHelper.addObjectIdEquals(criteria, "contractId", filter.contractId());
            MongoQueryHelper.addObjectIdEquals(criteria, "managerId", filter.managerId());
            MongoQueryHelper.addEquals(criteria, "type", filter.type());
            MongoQueryHelper.addEquals(criteria, "priority", filter.priority());
            MongoQueryHelper.addEquals(criteria, "status", filter.status());
            MongoQueryHelper.addKeyword(criteria, filter.keyword(), "title", "content");
        }

        Page<ReportRequest> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, ReportRequest.class);
        return PagedResponse.from(page.map(ReportRequestResponse::from));
    }

    @Override
    public ReportRequestResponse requestInfo(String id, ReportRequestInfoRequest request, AuthPrincipal principal) {
        requireRole(principal, "MANAGER", "ADMIN", "OWNER");
        ReportRequest report = findReport(id);

        if (report.getStatus() == ReportRequestStatus.CLOSED || report.getStatus() == ReportRequestStatus.REJECTED) {
            throw new BadRequestException("Không thể yêu cầu bổ sung thông tin cho yêu cầu đã đóng hoặc đã từ chối.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.WAITING_INFO);
        report.setRequestedInfoNote(request.note());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                principal != null ? principal.fullName() : "Quản lý",
                report.getManagerId(),
                ReportRecordAction.REQUESTED_INFO,
                previousStatus,
                ReportRequestStatus.WAITING_INFO,
                request.note(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse supplementInfo(String id, ReportRequestSupplementRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Yêu cầu không ở trạng thái chờ bổ sung thông tin.");
        }

        // Bổ sung nội dung và tệp đính kèm
        if (StringUtils.hasText(request.additionalInfo())) {
            report.setContent(report.getContent() + "\n\n[Bổ sung ngày " + Instant.now() + "]: " + request.additionalInfo());
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
                principal != null ? principal.fullName() : "Khách thuê",
                report.getManagerId(),
                ReportRecordAction.INFO_SUPPLEMENTED,
                previousStatus,
                ReportRequestStatus.PENDING,
                request.additionalInfo(),
                request.additionalAttachments() != null ? request.additionalAttachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse reject(String id, ReportRequestRejectRequest request, AuthPrincipal principal) {
        requireRole(principal, "MANAGER", "ADMIN", "OWNER");
        ReportRequest report = findReport(id);

        if (report.getStatus() == ReportRequestStatus.CLOSED || report.getStatus() == ReportRequestStatus.RESOLVED) {
            throw new BadRequestException("Không thể từ chối yêu cầu đã được giải quyết hoặc đã đóng.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.REJECTED);
        report.setRejectReason(request.reason());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                principal != null ? principal.fullName() : "Quản lý",
                report.getManagerId(),
                ReportRecordAction.REJECTED,
                previousStatus,
                ReportRequestStatus.REJECTED,
                request.reason(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse updateProgress(String id, ReportRequestProgressRequest request, AuthPrincipal principal) {
        requireRole(principal, "MANAGER", "ADMIN", "OWNER");
        ReportRequest report = findReport(id);

        if (report.getStatus() == ReportRequestStatus.CLOSED || report.getStatus() == ReportRequestStatus.REJECTED) {
            throw new BadRequestException("Không thể cập nhật tiến độ cho yêu cầu đã đóng hoặc đã từ chối.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                principal != null ? principal.fullName() : "Quản lý",
                report.getManagerId(),
                ReportRecordAction.PROGRESS_UPDATED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                request.progressNote(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse resolve(String id, ReportRequestResolveRequest request, AuthPrincipal principal) {
        requireRole(principal, "MANAGER", "ADMIN", "OWNER");
        ReportRequest report = findReport(id);

        if (report.getStatus() == ReportRequestStatus.CLOSED || report.getStatus() == ReportRequestStatus.REJECTED) {
            throw new BadRequestException("Yêu cầu đã kết thúc, không thể ghi nhận giải quyết.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.RESOLVED);
        report.setSolutionResult(request.solutionResult());
        report.setResolvedAt(Instant.now());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "MANAGER",
                principal != null ? principal.fullName() : "Quản lý",
                report.getManagerId(),
                ReportRecordAction.RESOLVED,
                previousStatus,
                ReportRequestStatus.RESOLVED,
                request.solutionResult(),
                request.attachments() != null ? request.attachments() : List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
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
                principal != null ? principal.fullName() : "Khách thuê",
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
    public ReportRequestResponse reopen(String id, ReportRequestReopenRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanView(report, principal);

        if (report.getStatus() != ReportRequestStatus.RESOLVED) {
            throw new BadRequestException("Chỉ có thể mở lại yêu cầu khi đang ở trạng thái đã giải quyết (RESOLVED).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.IN_PROGRESS);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "TENANT",
                principal != null ? principal.fullName() : "Người dùng",
                report.getManagerId(),
                ReportRecordAction.REOPENED,
                previousStatus,
                ReportRequestStatus.IN_PROGRESS,
                "Hai bên thống nhất mở lại để xử lý tiếp: " + request.reason(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse escalateAdmin(String id, ReportRequestEscalateAdminRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanView(report, principal);

        if (report.getStatus() == ReportRequestStatus.CLOSED) {
            throw new BadRequestException("Yêu cầu đã đóng hoàn tất, không thể chuyển tranh chấp.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.ESCALATED_ADMIN);
        report.setDisputeReason(request.disputeReason());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                principal != null ? principal.role() : "TENANT",
                principal != null ? principal.fullName() : "Người dùng",
                report.getManagerId(),
                ReportRecordAction.ESCALATED_ADMIN,
                previousStatus,
                ReportRequestStatus.ESCALATED_ADMIN,
                "Chuyển tranh chấp lên Admin xác minh: " + request.disputeReason(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse adminResolve(String id, ReportRequestAdminResolveRequest request, AuthPrincipal principal) {
        requireRole(principal, "ADMIN");
        ReportRequest report = findReport(id);

        if (report.getStatus() != ReportRequestStatus.ESCALATED_ADMIN) {
            throw new BadRequestException("Chỉ có thể giải quyết tranh chấp đối với yêu cầu đang chuyển Admin (ESCALATED_ADMIN).");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.CLOSED);
        report.setAdminConclusion(request.adminConclusion());
        report.setClosedAt(Instant.now());
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                "ADMIN",
                principal != null ? principal.fullName() : "Admin Quản trị viên",
                report.getManagerId(),
                ReportRecordAction.ADMIN_RESOLVED,
                previousStatus,
                ReportRequestStatus.CLOSED,
                "Admin đưa ra kết luận phân xử: " + request.adminConclusion(),
                List.of()
        );

        return getById(report.getId(), principal);
    }

    @Override
    public ReportRequestResponse cancel(String id, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureTenantOwnsOrAdmin(report, principal);

        if (report.getStatus() != ReportRequestStatus.PENDING && report.getStatus() != ReportRequestStatus.WAITING_INFO) {
            throw new BadRequestException("Chỉ có thể hủy yêu cầu khi đang ở trạng thái chờ tiếp nhận hoặc chờ bổ sung.");
        }

        ReportRequestStatus previousStatus = report.getStatus();
        report.setStatus(ReportRequestStatus.CANCELLED);
        reportRequestRepository.save(report);

        createRecord(
                report.getId(),
                principal != null ? principal.userId() : null,
                "TENANT",
                principal != null ? principal.fullName() : "Khách thuê",
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
    public ReportRequestResponse update(String id, ReportRequestUpdateRequest request, AuthPrincipal principal) {
        ReportRequest report = findReport(id);
        ensureCanManage(report, principal);

        if (request.type() != null) report.setType(request.type());
        if (StringUtils.hasText(request.title())) report.setTitle(request.title());
        if (StringUtils.hasText(request.content())) report.setContent(request.content());
        if (request.attachments() != null) report.setAttachments(request.attachments());
        if (request.priority() != null) report.setPriority(request.priority());
        if (request.status() != null) report.setStatus(request.status());
        if (request.rejectReason() != null) report.setRejectReason(request.rejectReason());

        ReportRequest updated = reportRequestRepository.save(report);
        return getById(updated.getId(), principal);
    }

    @Override
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
                User user = userRepository.findByEmailAndIsDeletedFalse(principal.email())
                        .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản người dùng tương ứng"));
                Tenant newTenant = new Tenant();
                newTenant.setEmail(user.getEmail());
                newTenant.setFullName(user.getFullName());
                newTenant.setPhone(user.getPhone());
                return tenantRepository.save(newTenant);
            });
        }
        if (StringUtils.hasText(inputTenantId)) {
            return tenantRepository.findByIdAndIsDeletedFalse(inputTenantId)
                    .orElseThrow(() -> new NotFoundException("Không tìm thấy khách thuê với id: " + inputTenantId));
        }
        if (principal == null || principal.email() == null) {
            throw new ForbiddenException("Không xác định được danh tính khách thuê hiện tại.");
        }
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElseGet(() -> {
            User user = userRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản người dùng tương ứng"));
            Tenant newTenant = new Tenant();
            newTenant.setEmail(user.getEmail());
            newTenant.setFullName(user.getFullName());
            newTenant.setPhone(user.getPhone());
            return tenantRepository.save(newTenant);
        });
    }

    private Contract findActiveContract(String tenantId, String roomId) {
        // Tìm các hợp đồng ACTIVE của phòng này
        List<Criteria> roomCriteria = new ArrayList<>();
        if (StringUtils.hasText(roomId)) {
            if (org.bson.types.ObjectId.isValid(roomId)) {
                roomCriteria.add(Criteria.where("roomId").is(new org.bson.types.ObjectId(roomId)));
            }
            roomCriteria.add(Criteria.where("roomId").is(roomId));
        }
        Criteria baseRoom = roomCriteria.isEmpty() ? new Criteria() : new Criteria().orOperator(roomCriteria.toArray(new Criteria[0]));

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

        // Kiểm tra xem Tenant có nằm trong ContractTenant active của một trong các hợp đồng trên không
        for (Contract c : contracts) {
            List<Criteria> ctCriteria = new ArrayList<>();
            if (org.bson.types.ObjectId.isValid(c.getId())) {
                ctCriteria.add(Criteria.where("contractId").is(new org.bson.types.ObjectId(c.getId())));
            }
            ctCriteria.add(Criteria.where("contractId").is(c.getId()));

            List<Criteria> tCriteria = new ArrayList<>();
            if (StringUtils.hasText(tenantId)) {
                if (org.bson.types.ObjectId.isValid(tenantId)) {
                    tCriteria.add(Criteria.where("tenantId").is(new org.bson.types.ObjectId(tenantId)));
                }
                tCriteria.add(Criteria.where("tenantId").is(tenantId));
            }

            Criteria combinedCt = new Criteria().andOperator(
                    new Criteria().orOperator(ctCriteria.toArray(new Criteria[0])),
                    tCriteria.isEmpty() ? new Criteria() : new Criteria().orOperator(tCriteria.toArray(new Criteria[0])),
                    Criteria.where("status").in(List.of(ContractTenantStatus.ACTIVE.name(), "ACTIVE")),
                    Criteria.where("isDeleted").is(false)
            );
            if (mongoTemplate.exists(new Query(combinedCt), ContractTenant.class)) {
                return c;
            }
        }

        // Nếu phòng chỉ có 1 hợp đồng ACTIVE duy nhất, gán hợp đồng đó
        if (contracts.size() == 1) {
            return contracts.get(0);
        }

        return null;
    }

    private String resolveManager(Room room, Contract contract) {
        if (contract != null && StringUtils.hasText(contract.getManagerId())) {
            return contract.getManagerId();
        }
        if (StringUtils.hasText(room.getManagerId())) {
            return room.getManagerId();
        }
        if (StringUtils.hasText(room.getBranchId())) {
            Query q = new Query(Criteria.where("branchId").is(MongoQueryHelper.toObjectId(room.getBranchId()))
                    .and("status").is(ManagerStatus.ACTIVE.name())
                    .and("isDeleted").is(false));
            Manager m = mongoTemplate.findOne(q, Manager.class);
            if (m != null) {
                return m.getId();
            }
        }
        return null;
    }

    private void ensureTenantOwnsOrAdmin(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role())) return;
        Tenant tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
        String currentTenantId = tenant != null ? tenant.getId() : principal.userId();
        if (!report.getTenantId().equals(currentTenantId)) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên yêu cầu này.");
        }
    }

    private void ensureCanView(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role())) return;
        if ("TENANT".equals(principal.role())) {
            ensureTenantOwnsOrAdmin(report, principal);
        } else if ("MANAGER".equals(principal.role())) {
            Manager manager = managerRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
            if (manager != null) {
                if (!manager.getId().equals(report.getManagerId()) && !manager.getBranchId().equals(report.getBranchId())) {
                    throw new ForbiddenException("Yêu cầu này không thuộc chi nhánh bạn quản lý.");
                }
            }
        }
    }

    private void ensureCanManage(ReportRequest report, AuthPrincipal principal) {
        if (principal == null) return;
        if ("ADMIN".equals(principal.role()) || "OWNER".equals(principal.role())) return;
        requireRole(principal, "MANAGER");
        Manager manager = managerRepository.findByEmailAndIsDeletedFalse(principal.email()).orElse(null);
        if (manager != null) {
            if (!manager.getId().equals(report.getManagerId()) && !manager.getBranchId().equals(report.getBranchId())) {
                throw new ForbiddenException("Bạn không có quyền xử lý yêu cầu ngoài chi nhánh của mình.");
            }
        }
    }

    private void requireRole(AuthPrincipal principal, String... roles) {
        if (principal == null) return;
        for (String r : roles) {
            if (r.equals(principal.role())) return;
        }
        throw new ForbiddenException("Vai trò hiện tại (" + principal.role() + ") không được phép thực hiện thao tác này.");
    }
}
