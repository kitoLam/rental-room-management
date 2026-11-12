package com.kitolam.rentalroommanagement.common.config;

import com.kitolam.rentalroommanagement.common.base.BaseRepositoryImpl;
import com.kitolam.rentalroommanagement.modules.reportrecord.enums.ReportRecordAction;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestPriority;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestStatus;
import com.kitolam.rentalroommanagement.modules.reportrequest.enums.ReportRequestType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.util.List;
import java.util.Locale;

@Configuration
@EnableMongoAuditing
@EnableMongoRepositories(
        basePackages = "com.kitolam.rentalroommanagement.modules",
        repositoryBaseClass = BaseRepositoryImpl.class
)
public class MongoConfig {

    /** Enables @Transactional for multi-document writes (Atlas runs as a replica set). */
    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory databaseFactory) {
        return new MongoTransactionManager(databaseFactory);
    }

    /** Prevents legacy/removed enum strings in existing documents from crashing Mongo reads. */
    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new StringToReportRequestStatusConverter(),
                new StringToReportRecordActionConverter(),
                new StringToReportRequestPriorityConverter(),
                new StringToReportRequestTypeConverter()
        ));
    }

    @ReadingConverter
    static class StringToReportRequestStatusConverter implements Converter<String, ReportRequestStatus> {
        @Override
        public ReportRequestStatus convert(String source) {
            if (source == null || source.isBlank()) {
                return ReportRequestStatus.PENDING;
            }
            String normalized = source.trim().toUpperCase(Locale.ROOT);
            return switch (normalized) {
                case "OPEN" -> ReportRequestStatus.PENDING;
                case "ACCEPTED" -> ReportRequestStatus.IN_PROGRESS;
                case "COMPLETED", "ESCALATED_ADMIN" -> ReportRequestStatus.RESOLVED;
                default -> {
                    try {
                        yield ReportRequestStatus.valueOf(normalized);
                    } catch (IllegalArgumentException ex) {
                        yield ReportRequestStatus.PENDING;
                    }
                }
            };
        }
    }

    @ReadingConverter
    static class StringToReportRecordActionConverter implements Converter<String, ReportRecordAction> {
        @Override
        public ReportRecordAction convert(String source) {
            if (source == null || source.isBlank()) {
                return ReportRecordAction.STATUS_CHANGED;
            }
            String normalized = source.trim().toUpperCase(Locale.ROOT);
            return switch (normalized) {
                case "OPEN" -> ReportRecordAction.CREATED;
                case "ACCEPTED", "ESCALATED_ADMIN" -> ReportRecordAction.STATUS_CHANGED;
                case "COMPLETED", "ADMIN_RESOLVED" -> ReportRecordAction.RESOLVED;
                default -> {
                    try {
                        yield ReportRecordAction.valueOf(normalized);
                    } catch (IllegalArgumentException ex) {
                        yield ReportRecordAction.STATUS_CHANGED;
                    }
                }
            };
        }
    }

    @ReadingConverter
    static class StringToReportRequestPriorityConverter implements Converter<String, ReportRequestPriority> {
        @Override
        public ReportRequestPriority convert(String source) {
            if (source == null || source.isBlank()) {
                return ReportRequestPriority.MEDIUM;
            }
            String normalized = source.trim().toUpperCase(Locale.ROOT);
            if ("NORMAL".equals(normalized)) {
                return ReportRequestPriority.MEDIUM;
            }
            try {
                return ReportRequestPriority.valueOf(normalized);
            } catch (IllegalArgumentException ex) {
                return ReportRequestPriority.MEDIUM;
            }
        }
    }

    @ReadingConverter
    static class StringToReportRequestTypeConverter implements Converter<String, ReportRequestType> {
        @Override
        public ReportRequestType convert(String source) {
            if (source == null || source.isBlank()) {
                return ReportRequestType.OTHER;
            }
            String normalized = source.trim().toUpperCase(Locale.ROOT);
            try {
                return ReportRequestType.valueOf(normalized);
            } catch (IllegalArgumentException ex) {
                return ReportRequestType.OTHER;
            }
        }
    }
}
