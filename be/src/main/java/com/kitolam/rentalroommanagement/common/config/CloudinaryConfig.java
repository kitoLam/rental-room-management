package com.kitolam.rentalroommanagement.common.config;

import com.cloudinary.Cloudinary;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableConfigurationProperties(CloudinaryProperties.class)
@RequiredArgsConstructor
public class CloudinaryConfig {

    private final CloudinaryProperties properties;

    @Bean
    public Cloudinary cloudinary() {
        Map<String, Object> config = new HashMap<>();
        config.put("cloud_name", properties.cloudName() != null ? properties.cloudName() : "");
        config.put("api_key", properties.apiKey() != null ? properties.apiKey() : "");
        config.put("api_secret", properties.apiSecret() != null ? properties.apiSecret() : "");
        config.put("secure", true);
        return new Cloudinary(config);
    }
}
