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
        Instant now = clock.instant();
        Query ready = Query.query(Criteria.where("isDeleted").is(false)
                        .and("status").in(ContractStatus.TEMPLATE, ContractStatus.DRAFT)
                        .and("pdfRevision").exists(true)
                        .and("pdfNextAttemptAt").lte(now))
                .with(Sort.by("pdfNextAttemptAt", "_id"));
        for (int i = 0; i < 5; i++) {
            Contract contract = mongo.findAndModify(ready, new Update().set("pdfNextAttemptAt", clock.instant().plusSeconds(300)),
                    FindAndModifyOptions.options().returnNew(true), Contract.class);
            if (contract == null) return;
            publish(contract);
        }
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
                    .set("pdfPublicId", asset.publicId()).unset("pdfNextAttemptAt"), Contract.class);
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
                    contract.getId(), stage, e.getClass().getSimpleName());
            mongo.updateFirst(sameRevision, new Update().set("pdfNextAttemptAt", clock.instant().plusSeconds(60)), Contract.class);
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
