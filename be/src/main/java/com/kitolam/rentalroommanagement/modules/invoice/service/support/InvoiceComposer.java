package com.kitolam.rentalroommanagement.modules.invoice.service.support;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.invoice.billing.BillingPeriod;
import com.kitolam.rentalroommanagement.modules.invoice.billing.InvoiceCalculator;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Fills the generated items of a draft invoice, never billing twice:
 * whatever earlier issued invoices of the same contract and month already billed
 * (issued, partially paid, paid, overdue; not cancelled) is subtracted item by item.
 */
@Component
@RequiredArgsConstructor
public class InvoiceComposer {

    /** Invoices whose items count as already billed. Drafts and cancelled invoices do not. */
    private static final List<InvoiceStatus> BILLED =
            List.of(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE);

    private final ContractBillingLoader billingLoader;
    private final InvoiceRepository invoiceRepository;

    /** computed = items the period produces; remaining = items left after subtracting what was already billed. */
    public record Result(int computed, int remaining) {
    }

    /** Replaces the generated items of {@code draft} (manual items are kept) and recomputes its totals. */
    public Result compose(Contract contract, BillingPeriod period, Invoice draft) {
        List<Invoice> others = invoiceRepository.findByContractIdAndPeriodAndIsDeletedFalse(contract.getId(), period.code())
                .stream()
                .filter(other -> !Objects.equals(other.getId(), draft.getId()))
                .toList();

        Map<String, BigDecimal> billed = new HashMap<>();
        others.stream()
                .filter(other -> BILLED.contains(other.getStatus()))
                .flatMap(other -> other.getItems().stream())
                .filter(item -> item.getType().isGenerated())
                .forEach(item -> billed.merge(key(item), item.getAmount(), BigDecimal::add));

        List<InvoiceItem> computed = InvoiceCalculator.calculate(billingLoader.load(contract, period), period);
        List<InvoiceItem> remaining = new ArrayList<>();
        for (InvoiceItem item : computed) {
            BigDecimal already = billed.getOrDefault(key(item), BigDecimal.ZERO);
            BigDecimal left = item.getAmount().subtract(already);
            if (left.signum() <= 0) continue;
            if (already.signum() > 0) {
                item.setDescription(item.getDescription() + " (đã trừ " + vnd(already) + " ₫ ở hoá đơn trước)");
                item.setQuantity(BigDecimal.ONE);
                item.setUnitPrice(left);
                item.setAmount(left);
            }
            remaining.add(item);
        }

        draft.getItems().removeIf(item -> item.getType().isGenerated());
        draft.getItems().addAll(0, remaining);
        InvoiceCalculator.applyTotals(draft);
        return new Result(computed.size(), remaining.size());
    }

    /** Another draft of the same contract and month (two drafts could bill the same thing twice). */
    public Optional<Invoice> otherDraft(String contractId, BillingPeriod period, String excludeId) {
        return invoiceRepository.findByContractIdAndPeriodAndIsDeletedFalse(contractId, period.code()).stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.DRAFT)
                .filter(invoice -> !Objects.equals(invoice.getId(), excludeId))
                .findFirst();
    }

    /** Identifies "the same charge" across invoices: type + where it comes from. */
    private static String key(InvoiceItem item) {
        return String.join("|", item.getType().name(), String.valueOf(item.getRoomId()), String.valueOf(item.getRoomSlotId()),
                String.valueOf(item.getSlotServiceId()), String.valueOf(item.getRoomServiceId()));
    }

    private static String vnd(BigDecimal amount) {
        return NumberFormat.getInstance(Locale.of("vi", "VN")).format(amount);
    }
}
