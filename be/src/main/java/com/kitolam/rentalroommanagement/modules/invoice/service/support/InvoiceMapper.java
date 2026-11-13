package com.kitolam.rentalroommanagement.modules.invoice.service.support;

import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceItemResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;

import java.util.List;

public final class InvoiceMapper {

    private InvoiceMapper() {
    }

    public static InvoiceResponse toResponse(Invoice i) {
        return new InvoiceResponse(i.getId(), i.getContractId(), i.getTenantId(), i.getBranchId(),
                i.getRoomId(), i.getRoomNumber(), i.getRoomSlotId(), i.getSlotCode(), i.getTenantName(), i.getContractNumber(),
                i.getInvoiceNumber(), i.getPeriod(), i.getIssueDate(), i.getDueDate(), i.getDiscountAmount(),
                i.getTotalAmount(), i.getPaidAmount(), i.getRemainingAmount(), i.getStatus(), items(i.getItems()),
                i.getCreatedAt(), i.getUpdatedAt());
    }

    public static List<InvoiceItemResponse> items(List<InvoiceItem> items) {
        return items == null ? List.of() : items.stream().map(InvoiceMapper::toItem).toList();
    }

    public static InvoiceItemResponse toItem(InvoiceItem i) {
        return new InvoiceItemResponse(i.getId(), i.getType(), i.getDescription(), i.getFromDate(), i.getToDate(),
                i.getQuantity(), i.getUnitPrice(), i.getAmount(), i.getWarning());
    }
}
