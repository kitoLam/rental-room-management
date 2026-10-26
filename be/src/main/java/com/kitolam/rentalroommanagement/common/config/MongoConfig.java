package com.kitolam.rentalroommanagement.common.config;

import com.kitolam.rentalroommanagement.common.base.BaseRepositoryImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

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
}
