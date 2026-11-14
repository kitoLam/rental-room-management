package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.upload.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class ContractPdfJob {

    private final MongoTemplate mongo;
    private final ContractPdfRenderer renderer;
    private final CloudinaryService cloudinary;
    private final Clock clock;

    @Bean(defaultCandidate = false)
    static ThreadPoolTaskScheduler contractPdfScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setThreadNamePrefix("contract-pdf-");
        return scheduler;
    }

    @Scheduled(fixedDelayString = "${contract.pdf.poll-delay-ms:5000}", scheduler = "contractPdfScheduler")
    public void publishPending() {
        for (int i = 0; i < 5; i++) {
            Instant now = clock.instant();
            Contract contract = claim(ContractStatus.DRAFT, now);
            if (contract == null) contract = claim(ContractStatus.TEMPLATE, now);
            if (contract == null) return;
            log.info("Contract PDF generation started for id={} status={} number={}",
                    contract.getId(), contract.getStatus(), contract.getContractNumber());
            publish(contract);
        }
    }

    private Contract claim(ContractStatus status, Instant now) {
        Criteria ready = Criteria.where("isDeleted").is(false)
                .and("status").is(status)
                .and("pdfRevision").ne(null)
                .and("pdfNextAttemptAt").lte(now);
        if (status == ContractStatus.DRAFT) ready.and("termMonths").ne(null);
        return mongo.findAndModify(Query.query(ready).with(Sort.by("pdfNextAttemptAt", "_id")),
                new Update().set("pdfNextAttemptAt", now.plusSeconds(300)).set("pdfProcessing", true),
                FindAndModifyOptions.options().returnNew(true), Contract.class);
    }

    public String requestRetry(Contract contract) {
        Instant now = clock.instant();
        Criteria retryable = new Criteria().orOperator(
                Criteria.where("pdfProcessing").ne(true),
                Criteria.where("pdfNextAttemptAt").lte(now));
        Query query = Query.query(Criteria.where("_id").is(contract.getId()).and("isDeleted").is(false)
                .and("status").is(ContractStatus.DRAFT).and("pdfRevision").is(contract.getPdfRevision())
                .and("pdfNextAttemptAt").is(contract.getPdfNextAttemptAt())
                .and("evidenceDeadline").gt(now).and("contractUrl").is(null)).addCriteria(retryable);
        var result = mongo.updateFirst(query, new Update().set("pdfNextAttemptAt", now), Contract.class);
        if (result.getMatchedCount() > 0) {
            log.info("Contract PDF retry queued for id={}", contract.getId());
            return "QUEUED";
        }
        log.info("Contract PDF retry left current job unchanged for id={}", contract.getId());
        return "PROCESSING";
    }

    private void publish(Contract contract) {
        Query sameRevision = Query.query(Criteria.where("_id").is(contract.getId())
                .and("isDeleted").is(false).and("pdfRevision").is(contract.getPdfRevision())
                .and("pdfNextAttemptAt").is(contract.getPdfNextAttemptAt())
                .and("status").in(ContractStatus.TEMPLATE, ContractStatus.DRAFT));
        String stage = "render";
        try {
            String name = "Hop_Dong_Phong_%s_%s_%s.pdf".formatted(contract.getRoomId(),
                    contract.getRoomSlotId(), contract.getId());
            byte[] pdf = renderer.render(contract);
            stage = "cloudinary-upload";
            var asset = cloudinary.uploadContractPdf(pdf, contract.getPdfRevision(), name);
            if (asset.publicId() == null || asset.url() == null) {
                throw new IllegalStateException("Cloudinary did not return an asset");
            }
            stage = "save";
            var result = mongo.updateFirst(sameRevision, new Update().set("contractUrl", asset.url())
                    .set("pdfPublicId", asset.publicId()).unset("pdfNextAttemptAt").unset("pdfProcessing"), Contract.class);
            if (result.getMatchedCount() > 0) log.info("Contract PDF generation completed for id={} status={} number={}",
                    contract.getId(), contract.getStatus(), contract.getContractNumber());
            if (result.getMatchedCount() > 0 && !Objects.equals(contract.getPdfPublicId(), asset.publicId())) {
                deletePrevious(contract.getId(), contract.getPdfPublicId());
            } else if (result.getMatchedCount() == 0) {
                Contract current = mongo.findById(contract.getId(), Contract.class);
                if (current == null || !Objects.equals(current.getPdfRevision(), contract.getPdfRevision())
                        || Boolean.TRUE.equals(current.getIsDeleted())) {
                    deletePrevious(contract.getId(), asset.publicId());
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Contract PDF generation failed for id={} at stage={} ({})",
                    contract.getId(), stage, e instanceof ContractPdfRenderer.ConversionException
                            ? e.getMessage() : e.getClass().getSimpleName());
            mongo.updateFirst(sameRevision, new Update().set("pdfNextAttemptAt", clock.instant().plusSeconds(60))
                    .unset("pdfProcessing"), Contract.class);
        }
    }

    private void deletePrevious(String contractId, String publicId) {
        if (publicId == null) return;
        try {
            cloudinary.deleteContractPdf(publicId);
        } catch (Exception e) {
            log.warn("Contract PDF cleanup failed for id={} ({})", contractId, e.getClass().getSimpleName());
        }
    }
}
