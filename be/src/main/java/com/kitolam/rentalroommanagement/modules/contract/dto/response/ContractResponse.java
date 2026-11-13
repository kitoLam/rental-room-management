package com.kitolam.rentalroommanagement.modules.contract.dto.response;

import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractEvidenceHistoryEntry;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ContractResponse(
        String id,
        String roomId,
        String roomName,
        String roomSlotId,
        List<String> roomSlotIds,
        String bookingId,
        String tenantId,
        String managerId,
        String contractNumber,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal rentPrice,
        BigDecimal contractDepositAmount,
        String landlordName,
        String landlordIdNumber,
        String landlordAddress,
        String tenantName,
        String tenantIdNumber,
        String tenantAddress,
        String roomAddress,
        Integer maxOccupants,
        List<ContractServiceSnapshot> services,
        Integer paymentDueDay,
        String terms,
        String signedFileUrl,
        String signedEvidenceUrl,
        Integer termMonths,
        LocalDate signedDate,
        LocalDate firstBillingStartDate,
        Instant evidenceSubmittedAt,
        Instant evidenceDeadline,
        Integer evidenceResubmissionCount,
        String evidenceNote,
        List<ContractEvidenceHistoryEntry> evidenceHistory,
        String contractUrl,
        boolean generatedPdf,
        Instant terminatedAt,
        String terminationReason,
        ContractStatus status,
        List<com.kitolam.rentalroommanagement.modules.contract.document.ActiveSlotService> activeSlotServices,
        /** Hợp đồng đang hiệu lực và còn ≤ 60 ngày tới hạn (dùng cho cảnh báo "Sắp hết hạn"). */
        boolean expiringSoon,
        String renewedFromContractId,
        String renewedToContractId,
        Instant createdAt,
        Instant updatedAt
) {
}
