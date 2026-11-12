package com.kitolam.rentalroommanagement.modules.dashboard.dto.response;

import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService.TenantInvoice;
import com.kitolam.rentalroommanagement.modules.notification.dto.response.NotificationResponse;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService.ReportPayment;
import com.kitolam.rentalroommanagement.modules.reportrequest.service.ReportRequestService.TenantSupport;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record TenantOverviewResponse(Instant generatedAt, LocalDate asOfDate, Lease tenancy,
        Long unpaidInvoiceCount, LocalDate nextDueDate, BigDecimal nextDueAmount, boolean incompleteBalances,
        long openSupportCount, long needsResponseCount, Long activeSubscriptions, long pendingServiceRequests,
        List<TenantInvoice> recentInvoices, List<TenantSupport> recentSupport,
        ReportPayment latestPayment, List<NotificationResponse> notifications) {
    public record Lease(String id, String contractId, String contractNumber, String contractStatus, String status,
                        String branchId, String branchName, String address, String branchPhone,
                        String roomId, String roomNumber, List<String> roomSlotIds, List<String> slotCodes,
                        LocalDate startDate, LocalDate endDate, BigDecimal rentAmount, boolean representative,
                        BigDecimal contractRentPrice, BigDecimal contractDepositAmount, String terms,
                        String signedFileUrl, LocalDate signedDate) { }
}
