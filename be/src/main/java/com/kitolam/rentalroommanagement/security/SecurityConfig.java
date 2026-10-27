package com.kitolam.rentalroommanagement.security;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityProperties properties,
            JwtProvider jwt, AuthUserDetailsService users, SecurityErrorHandler errors) throws Exception {
        return http
                // Authentication uses explicit bearer headers / JSON tokens, never session cookies.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .exceptionHandling(handler -> handler.authenticationEntryPoint(errors).accessDeniedHandler(errors))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.POST, "/auth/signup", "/auth/login",
                            "/auth/resend-verification", "/auth/refresh", "/auth/logout").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/auth/verify-email").permitAll();
                    if (properties.publicDocs()) {
                        auth.requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll();
                    }
                    // Existing CRUD exposes management data; tenants need future ownership-scoped endpoints.
                    auth.requestMatchers("/api/v1/**").hasAnyRole("MANAGER", "ADMIN");
                    auth.anyRequest().authenticated();
                })
                .addFilterBefore(new JwtAuthenticationFilter(jwt, users, errors, properties.requireHttps()),
                        UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
