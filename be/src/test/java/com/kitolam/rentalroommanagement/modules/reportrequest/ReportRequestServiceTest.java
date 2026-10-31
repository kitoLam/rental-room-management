package com.kitolam.rentalroommanagement.modules.reportrequest;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.reportrecord.document.ReportRecord;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrecord.repository.ReportRecordRepository;
import com.kitolam.rentalroommanagement.modules.reportrequest.document.ReportRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestAdminResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestCreateRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestEscalateAdminRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestInfoRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestProgressRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestRejectRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestReopenRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestResolveRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.request.ReportRequestSupplementRequest;
import com.kitolam.rentalroommanagement.modules.reportrequest.dto.response.ReportRequestResponse;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
import com.kitolam.rentalroommanagement.modules.reportrequest.repository.ReportRequestRepository;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.impl.ReportRequestServiceImpl;
import com.kitolam.rentalroommanagement.modules.reportrequestfurniture.repository.ReportRequestFurnitureRepository;
import com.kitolam.rentalroommanagement.modules.reportrequestservice.repository.ReportRequestServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportRequestServiceTest {

    @Mock private ReportRequestRepository reportRequestRepository;
    @Mock private ReportRecordRepository reportRecordRepository;
    @Mock private ReportRequestFurnitureRepository reportRequestFurnitureRepository;
    @Mock private ReportRequestServiceItemRepository reportRequestServiceItemRepository;
    @Mock private ContractRepository contractRepository;
    @Mock private ContractTenantRepository contractTenantRepository;
    @Mock private RoomRepository roomRepository;
    @Mock private ManagerRepository managerRepository;
    @Mock private TenantRepository tenantRepository;
    @Mock private UserRepository userRepository;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private ReportRequestServiceImpl service;

    private final String tenantId = "60c72b2f9b1d8b2bad000001";
    private final String roomId = "60c72b2f9b1d8b2bad000002";
    private final String branchId = "60c72b2f9b1d8b2bad000003";
    private final String contractId = "60c72b2f9b1d8b2bad000004";
    private final String managerId = "60c72b2f9b1d8b2bad000005";
    private final String reportId = "60c72b2f9b1d8b2bad000006";

    private AuthPrincipal tenantPrincipal;
    private AuthPrincipal managerPrincipal;
    private AuthPrincipal adminPrincipal;
    private Tenant tenant;
    private Room room;
    private Contract contract;

    @BeforeEach
    void setUp() {
        tenantPrincipal = new AuthPrincipal(tenantId, "tenant@example.com", "TENANT");
        managerPrincipal = new AuthPrincipal(managerId, "manager@example.com", "MANAGER");
        adminPrincipal = new AuthPrincipal("admin-id", "admin@example.com", "ADMIN");

        tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setEmail("tenant@example.com");
        tenant.setFullName("Nguyen Van A");

        room = new Room();
        room.setId(roomId);
        room.setBranchId(branchId);
        room.setManagerId(managerId);

        contract = new Contract();
        contract.setId(contractId);
        contract.setRoomId(roomId);
        contract.setManagerId(managerId);
        contract.setStatus(ContractStatus.ACTIVE);
    }

    @Test
    void create_shouldThrowBadRequest_whenNoActiveContract() {
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(roomRepository.findByIdAndIsDeletedFalse(roomId)).thenReturn(Optional.of(room));
        when(mongoTemplate.find(any(Query.class), eq(Contract.class))).thenReturn(List.of());

        ReportRequestCreateRequest req = new ReportRequestCreateRequest(
                tenantId, roomId, ReportRequestType.REPAIR, "Hong dieu hoa", "Mo ta", List.of(), ReportRequestPriority.HIGH, null, null
        );

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.create(req, tenantPrincipal));
        assertTrue(ex.getMessage().contains("không có hợp đồng đang có hiệu lực"));
        verifyNoInteractions(reportRequestRepository, reportRecordRepository,
                reportRequestFurnitureRepository, reportRequestServiceItemRepository);
    }

    @Test
    void create_shouldSucceed_andAutoAssignManager_andCreateTimeline() {
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(roomRepository.findByIdAndIsDeletedFalse(roomId)).thenReturn(Optional.of(room));
        when(mongoTemplate.find(any(Query.class), eq(Contract.class))).thenReturn(List.of(contract));
        when(mongoTemplate.exists(any(Query.class), eq(ContractTenant.class))).thenReturn(true);

        ReportRequest savedReport = new ReportRequest();
        savedReport.setId(reportId);
        savedReport.setTenantId(tenantId);
        savedReport.setRoomId(roomId);
        savedReport.setBranchId(branchId);
        savedReport.setContractId(contractId);
        savedReport.setManagerId(managerId);
        savedReport.setType(ReportRequestType.REPAIR);
        savedReport.setTitle("Hong dieu hoa");
        savedReport.setContent("Mo ta chi tiet");
        savedReport.setStatus(ReportRequestStatus.PENDING);

        when(reportRequestRepository.save(any(ReportRequest.class))).thenReturn(savedReport);
        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(savedReport));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestCreateRequest req = new ReportRequestCreateRequest(
                tenantId, roomId, ReportRequestType.REPAIR, "Hong dieu hoa", "Mo ta chi tiet", List.of(), ReportRequestPriority.HIGH, null, null
        );

        ReportRequestResponse res = service.create(req, tenantPrincipal);

        assertNotNull(res);
        assertEquals(reportId, res.id());
        assertEquals(managerId, res.managerId());
        assertEquals(ReportRequestStatus.PENDING, res.status());
        verify(reportRecordRepository, atLeast(1)).save(any(ReportRecord.class));
    }

    @Test
    void requestInfo_shouldChangeStatusToWaitingInfo() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setStatus(ReportRequestStatus.PENDING);
        report.setManagerId(managerId);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestInfoRequest req = new ReportRequestInfoRequest("Vui long chup them anh hien truong");
        ReportRequestResponse res = service.requestInfo(reportId, req, managerPrincipal);

        assertEquals(ReportRequestStatus.WAITING_INFO, res.status());
        assertEquals("Vui long chup them anh hien truong", res.requestedInfoNote());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.REQUESTED_INFO));
    }

    @Test
    void supplementInfo_shouldChangeStatusBackToPending() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setTenantId(tenantId);
        report.setStatus(ReportRequestStatus.WAITING_INFO);
        report.setContent("Ban dau");

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestSupplementRequest req = new ReportRequestSupplementRequest("Da them anh va mo ta", List.of("url1"));
        ReportRequestResponse res = service.supplementInfo(reportId, req, tenantPrincipal);

        assertEquals(ReportRequestStatus.PENDING, res.status());
        assertTrue(res.content().contains("Da them anh va mo ta"));
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.INFO_SUPPLEMENTED));
    }

    @Test
    void reject_shouldChangeStatusToRejected() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setStatus(ReportRequestStatus.PENDING);
        report.setManagerId(managerId);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestRejectRequest req = new ReportRequestRejectRequest("Khong thuoc quy dinh sua chua");
        ReportRequestResponse res = service.reject(reportId, req, managerPrincipal);

        assertEquals(ReportRequestStatus.REJECTED, res.status());
        assertEquals("Khong thuoc quy dinh sua chua", res.rejectReason());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.REJECTED));
    }

    @Test
    void updateProgress_shouldChangeStatusToInProgress() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setStatus(ReportRequestStatus.PENDING);
        report.setManagerId(managerId);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestProgressRequest req = new ReportRequestProgressRequest("Tho dang den kiem tra", List.of());
        ReportRequestResponse res = service.updateProgress(reportId, req, managerPrincipal);

        assertEquals(ReportRequestStatus.IN_PROGRESS, res.status());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.PROGRESS_UPDATED));
    }

    @Test
    void resolve_shouldChangeStatusToResolved() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setStatus(ReportRequestStatus.IN_PROGRESS);
        report.setManagerId(managerId);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestResolveRequest req = new ReportRequestResolveRequest("Da thay tu lanh moi hoan tat", List.of("url-new"));
        ReportRequestResponse res = service.resolve(reportId, req, managerPrincipal);

        assertEquals(ReportRequestStatus.RESOLVED, res.status());
        assertEquals("Da thay tu lanh moi hoan tat", res.solutionResult());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.RESOLVED));
    }

    @Test
    void confirmClose_shouldChangeStatusToClosed() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setTenantId(tenantId);
        report.setStatus(ReportRequestStatus.RESOLVED);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestResponse res = service.confirmClose(reportId, tenantPrincipal);

        assertEquals(ReportRequestStatus.CLOSED, res.status());
        assertNotNull(res.closedAt());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.CLOSED));
    }

    @Test
    void reopen_shouldChangeStatusBackToInProgress() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setTenantId(tenantId);
        report.setStatus(ReportRequestStatus.RESOLVED);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestReopenRequest req = new ReportRequestReopenRequest("Van con chay nuoc");
        ReportRequestResponse res = service.reopen(reportId, req, tenantPrincipal);

        assertEquals(ReportRequestStatus.IN_PROGRESS, res.status());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.REOPENED));
    }

    @Test
    void escalateAdmin_shouldChangeStatusToEscalatedAdmin() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setTenantId(tenantId);
        report.setStatus(ReportRequestStatus.IN_PROGRESS);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(tenantRepository.findByEmailAndIsDeletedFalse(tenantPrincipal.email())).thenReturn(Optional.of(tenant));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestEscalateAdminRequest req = new ReportRequestEscalateAdminRequest("Hai ben bat dong quan diem boi thuong");
        ReportRequestResponse res = service.escalateAdmin(reportId, req, tenantPrincipal);

        assertEquals(ReportRequestStatus.ESCALATED_ADMIN, res.status());
        assertEquals("Hai ben bat dong quan diem boi thuong", res.disputeReason());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.ESCALATED_ADMIN));
    }

    @Test
    void adminResolve_shouldCloseDispute_withConclusion() {
        ReportRequest report = new ReportRequest();
        report.setId(reportId);
        report.setStatus(ReportRequestStatus.ESCALATED_ADMIN);

        when(reportRequestRepository.findByIdAndIsDeletedFalse(reportId)).thenReturn(Optional.of(report));
        when(reportRequestRepository.save(any(ReportRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(reportRecordRepository.findByReportRequestIdAndIsDeletedFalseOrderByCreatedAtAsc(reportId)).thenReturn(List.of());

        ReportRequestAdminResolveRequest req = new ReportRequestAdminResolveRequest("Admin yeu cau chu tro chiu 70% chi phi sua chua");
        ReportRequestResponse res = service.adminResolve(reportId, req, adminPrincipal);

        assertEquals(ReportRequestStatus.CLOSED, res.status());
        assertEquals("Admin yeu cau chu tro chiu 70% chi phi sua chua", res.adminConclusion());
        verify(reportRecordRepository).save(argThat(r -> r.getAction() == ReportRecordAction.ADMIN_RESOLVED));
    }
}
