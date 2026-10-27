package com.kitolam.rentalroommanagement.common.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI configuration.
 *
 * <p>Bearer authentication is configured in security/OpenApiSecurityConfig.
 */
@Configuration
@OpenAPIDefinition(
        info = @Info(
                title       = "Rental Room Management API",
                version     = "v1",
                description = "Backend API for the Rental Room Management System"
        )
)
public class OpenApiConfig {
    // No beans needed — annotations are processed by springdoc-openapi at startup
}
