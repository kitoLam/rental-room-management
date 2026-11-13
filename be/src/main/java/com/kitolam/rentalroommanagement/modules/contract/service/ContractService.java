package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.common.dto.ActivitySnapshot;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractRenewRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractEvidenceReviewRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import org.springframework.data.domain.Pageable;

public interface ContractService {

    ContractResponse create(ContractCreateRequest request);

    ContractResponse getById(String id, AuthPrincipal principal);

    ContractResponse chooseTerm(String id, int termMonths, AuthPrincipal principal);

    String downloadPdf(String id, AuthPrincipal principal);

    String downloadSignedEvidence(String id, AuthPrincipal principal);

    PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    ContractResponse update(String id, ContractUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    String nextContractNumber();

    ContractResponse selectServices(String id, ContractServiceSelectionRequest request, AuthPrincipal principal);

    ContractResponse completeCheckIn(String id, ContractCheckInRequest request, AuthPrincipal principal);

    ContractResponse submitEvidence(String id, ContractEvidenceRequest request, AuthPrincipal principal);

    ContractResponse reviewEvidence(String id, ContractEvidenceReviewRequest request, AuthPrincipal principal);

    ContractResponse renew(String id, ContractRenewRequest request, AuthPrincipal principal);

    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewContract> readForOverview(List<String> ids);

    /** Read-only report projection, scoped to room IDs already authorized by the caller. */
    List<ReportContract> readForReports(List<String> roomIds);

    record ReportContract(String id, String roomId,
                          com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status,
                          java.time.LocalDate startDate, java.time.LocalDate endDate,
                          java.time.Instant terminatedAt, List<String> roomSlotIds) { }

    record OverviewContract(String id, String roomId, String tenantId, String bookingId, String contractNumber,
                            com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status,
                            java.time.LocalDate startDate, java.time.LocalDate endDate, java.time.Instant evidenceSubmittedAt,
                            List<String> roomSlotIds) {
        public OverviewContract(String id, String roomId, String tenantId, String bookingId, String contractNumber,
                                com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus status,
                                java.time.LocalDate startDate, java.time.LocalDate endDate, java.time.Instant evidenceSubmittedAt) {
            this(id, roomId, tenantId, bookingId, contractNumber, status, startDate, endDate, evidenceSubmittedAt, List.of());
        }
    }

    /** Read audit events for already-authorized subject IDs, in [from, to). */
    java.util.List<ActivitySnapshot> readActivitiesForOverview(java.util.List<String> ids, java.time.Instant from, java.time.Instant to);
}
