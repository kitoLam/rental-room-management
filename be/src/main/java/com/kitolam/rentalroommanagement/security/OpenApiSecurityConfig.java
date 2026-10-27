package com.kitolam.rentalroommanagement.security;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.*;

@Configuration
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiSecurityConfig {
    @Bean
    OpenApiCustomizer securedOperations() {
        return api -> api.getPaths().forEach((path, item) -> {
            if (!path.startsWith("/auth/")) {
                item.readOperations().forEach(operation -> operation.addSecurityItem(
                        new io.swagger.v3.oas.models.security.SecurityRequirement().addList("bearerAuth")));
            }
        });
    }
}
