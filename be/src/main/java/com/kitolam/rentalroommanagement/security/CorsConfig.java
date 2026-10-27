package com.kitolam.rentalroommanagement.security;

import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.web.cors.*;
import org.springframework.web.filter.CorsFilter;
import java.io.IOException;
import java.util.List;

@Configuration
public class CorsConfig {
    @Bean
    CorsFilter corsFilter(SecurityProperties properties, SecurityErrorHandler errors) {
        var config = new CorsConfiguration();
        if (properties.allowedOrigins().stream().anyMatch(origin -> origin.contains("*"))) {
            throw new IllegalStateException("CORS phải liệt kê origin cụ thể");
        }
        config.setAllowedOrigins(properties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        var filter = new CorsFilter(source);
        filter.setCorsProcessor(new DefaultCorsProcessor() {
            @Override
            protected void rejectRequest(ServerHttpResponse response) throws IOException {
                errors.write(((ServletServerHttpResponse) response).getServletResponse(), 403, "Origin không được phép");
            }
        });
        return filter;
    }

    @Bean
    FilterRegistrationBean<CorsFilter> corsRegistration(CorsFilter corsFilter) {
        var registration = new FilterRegistrationBean<>(corsFilter);
        registration.setEnabled(false); // Run only inside the Spring Security chain.
        return registration;
    }
}
