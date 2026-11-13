package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;

/**
 * Day 1 of every month: invoices the month that just ended for every slot with a contract in it.
 * Slots already invoiced by staff (estimate page) are skipped, so nothing is billed twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MonthlyInvoiceJob {

    private final InvoiceGenerationService generationService;
    private final Clock clock;

    @Scheduled(cron = "${invoice.monthly.cron:0 5 0 1 * *}", zone = "Asia/Ho_Chi_Minh")
    public void run() {
        YearMonth month = YearMonth.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh"))).minusMonths(1);
        int created = generationService.generateAll(month);
        log.info("Monthly invoice job: created {} invoices for {}", created, month);
    }
}
