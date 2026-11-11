package com.kitolam.rentalroommanagement.modules.invoice.service.support;

import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceItemResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;

public final class InvoiceResponses {

    private InvoiceResponses() {
    }

    public static InvoiceResponse of(Invoice invoice) {
        return new InvoiceResponse(invoice.getId(), invoice.getContractId(), invoice.getTenantId(), invoice.getBranchId(),
                invoice.getInvoiceNumber(), invoice.getPeriod(), invoice.getKind(), invoice.getIssueDate(), invoice.getDueDate(),
                invoice.getPreviousDebt(), invoice.getDiscountAmount(), invoice.getTotalAmount(), invoice.getPaidAmount(),
                invoice.getRemainingAmount(), invoice.getStatus(),
                invoice.getItems().stream().map(InvoiceResponses::of).toList(),
                invoice.getCreatedAt(), invoice.getUpdatedAt());
    }

    private static InvoiceItemResponse of(InvoiceItem item) {
        return new InvoiceItemResponse(item.getId(), item.getType(), item.getRoomId(), item.getRoomSlotId(),
                item.getSlotServiceId(), item.getRoomServiceId(), item.getRoomServiceChargeId(), item.getDescription(),
                item.getFromDate(), item.getToDate(), item.getQuantity(), item.getUnitPrice(), item.getAmount());
    }
}
