package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.LatePaymentHistoryResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtResponse;
import org.springframework.data.domain.Pageable;

public interface InvoiceService {

    /** Staff of the invoice's branch, or a tenant of its contract. */
    InvoiceResponse getById(String id, AuthPrincipal principal);

    /** Invoices of a branch for a month (staff). */
    List<InvoiceResponse> listForBranch(String branchId, String period, AuthPrincipal principal);

    /** The signed-in tenant's issued invoices, newest period first. */
    PagedResponse<InvoiceResponse> my(AuthPrincipal principal, int page, int size);

    /** Công nợ theo kỳ của Owner/Manager (theo cơ sở) hoặc Tenant (chỉ của chính mình). */
    PagedResponse<TenantDebtResponse> listDebts(String branchId, String keyword, boolean overdueOnly,
                                                String period, Pageable pageable, AuthPrincipal principal);

    /** Thu đủ công nợ của kỳ đang chọn; trả về bản ghi công nợ sau khi cập nhật. */
    TenantDebtResponse payDebt(String debtId, AuthPrincipal principal);

    /** Đặt lại một kỳ về chưa thanh toán (chỉ Owner/Manager/Admin). */
    TenantDebtResponse unpayDebt(String debtId, AuthPrincipal principal);

    /** Lịch sử trễ hạn của một hợp đồng, mới nhất trước; rỗng nếu người gọi không có quyền. */
    List<LatePaymentHistoryResponse> latePaymentHistory(String contractId, AuthPrincipal principal);

    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewInvoice> readForOverview(List<String> ids);

    /** Issued, non-cancelled invoices without deposit lines; contract IDs must already be authorized. */
    List<OverviewInvoice> readForReports(List<String> contractIds);

    /** Read issued invoices for already-authorized contract IDs, without calculating or updating balances. */
    List<TenantInvoice> readForTenantOverview(List<String> contractIds);

    record TenantInvoice(String id, String invoiceNumber, String period, java.time.LocalDate dueDate,
                         java.math.BigDecimal totalAmount, java.math.BigDecimal remainingAmount,
                         com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus status) { }

    /** Issued invoices that still have an outstanding balance; contract IDs must already be authorized. */
    List<DebtInvoice> readDebts(List<String> contractIds);

    record DebtInvoice(String id, String contractId, String invoiceNumber, String period,
                       java.time.LocalDate dueDate, java.math.BigDecimal totalAmount,
                       java.math.BigDecimal remainingAmount) { }

    record OverviewInvoice(String id, String contractId) { }
}
